import json
import logging
import math
import re

from odoo import api, fields, models

from .intelligence_groq import EMBED_DIM, embed_texts

_logger = logging.getLogger(__name__)


def _chunks_from_text(text, size=900, overlap=120):
    clean = re.sub(r"\s+", " ", text or "").strip()
    if not clean:
        return []
    parts = []
    start = 0
    while start < len(clean):
        parts.append(clean[start : start + size])
        start += max(size - overlap, 1)
    return parts


class IntelligenceChunk(models.Model):
    _name = "doc.intelligence.chunk"
    _description = "Indexed Intelligence Chunk"
    _order = "id"

    record_id = fields.Many2one(
        "doc.intelligence.record",
        required=True,
        ondelete="cascade",
        index=True,
    )
    document_id = fields.Many2one(
        "doc.document",
        related="record_id.document_id",
        store=True,
        index=True,
    )
    employee_id = fields.Many2one(
        "hr.employee",
        related="record_id.employee_id",
        store=True,
        index=True,
    )
    page = fields.Integer(default=1)
    content = fields.Text(required=True)
    embedding_json = fields.Text()
    embedding_model = fields.Char()

    def init(self):
        cr = self.env.cr
        cr.execute("SAVEPOINT di_pgvector")
        try:
            cr.execute("CREATE EXTENSION IF NOT EXISTS vector")
            cr.execute(
                """
                ALTER TABLE doc_intelligence_chunk
                ADD COLUMN IF NOT EXISTS embedding vector(%s)
                """
                % EMBED_DIM
            )
            cr.execute(
                """
                CREATE INDEX IF NOT EXISTS doc_intelligence_chunk_embedding_hnsw
                ON doc_intelligence_chunk
                USING hnsw (embedding vector_cosine_ops)
                """
            )
            cr.execute("RELEASE SAVEPOINT di_pgvector")
        except Exception as error:
            cr.execute("ROLLBACK TO SAVEPOINT di_pgvector")
            _logger.warning("pgvector is not available yet: %s", error)

    def _write_vector(self, vector):
        self.ensure_one()
        payload = json.dumps(vector)
        self.embedding_json = payload
        if not vector:
            return
        literal = "[" + ",".join("%.8f" % float(value) for value in vector) + "]"
        try:
            self.env.cr.execute(
                """
                UPDATE doc_intelligence_chunk
                SET embedding = %s::vector
                WHERE id = %s
                """,
                (literal, self.id),
            )
        except Exception as error:
            _logger.debug("Could not store pgvector column: %s", error)

    @api.model
    def index_record(self, record):
        record.chunk_ids.unlink()
        texts = []
        for field in record.field_ids.filtered(lambda item: item.value):
            texts.append("%s: %s" % (field.name, field.value))
        texts.extend(_chunks_from_text(record.extracted_text or ""))
        if not texts:
            return self.browse()
        try:
            vectors = embed_texts(texts, env=self.env)
        except Exception as error:
            _logger.warning("Embedding failed, storing text-only chunks: %s", error)
            vectors = [[] for _ in texts]
        chunks = self.browse()
        for index, text in enumerate(texts):
            chunk = self.create(
                {
                    "record_id": record.id,
                    "page": record.page_count or 1,
                    "content": text,
                    "embedding_model": "nomic-embed-text-v1_5",
                }
            )
            if index < len(vectors):
                chunk._write_vector(vectors[index])
            chunks |= chunk
        self.env["doc.intelligence.audit.event"].log_event(
            "knowledge",
            "indexed",
            target=record,
            detail="Stored %s chunk(s)." % len(chunks),
            correlation_id="job-%s" % record.job_id.id,
        )
        return chunks

    @api.model
    def search_similar(self, question, limit=8):
        domain = [
            ("record_id.review_status", "in", ["approved", "overridden"]),
        ]
        user = self.env.user
        is_admin = user.has_group("base.group_system") or user.has_group(
            "cleon_document_management.group_document_admin"
        )
        if not is_admin:
            employee = user.employee_id
            domain.append(("employee_id", "=", employee.id if employee else 0))
        allowed = self.search(domain)
        if not allowed:
            return self.browse()
        try:
            query_vector = (embed_texts([question], env=self.env) or [[]])[0]
        except Exception as error:
            _logger.warning("Query embedding failed: %s", error)
            query_vector = []
        if query_vector:
            literal = "[" + ",".join("%.8f" % float(v) for v in query_vector) + "]"
            try:
                self.env.cr.execute(
                    """
                    SELECT id
                    FROM doc_intelligence_chunk
                    WHERE id = ANY(%s)
                      AND embedding IS NOT NULL
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                    """,
                    (allowed.ids, literal, limit),
                )
                ids = [row[0] for row in self.env.cr.fetchall()]
                if ids:
                    return self.browse(ids)
            except Exception as error:
                _logger.debug("pgvector search failed, using python cosine: %s", error)
            scored = []
            for chunk in allowed:
                vector = json.loads(chunk.embedding_json or "[]")
                if not vector:
                    continue
                scored.append((self._cosine(query_vector, vector), chunk))
            scored.sort(key=lambda item: item[0], reverse=True)
            return self.browse([chunk.id for _score, chunk in scored[:limit]])
        return allowed[:limit]

    @staticmethod
    def _cosine(left, right):
        if not left or not right or len(left) != len(right):
            return 0.0
        dot = sum(a * b for a, b in zip(left, right))
        norm_l = math.sqrt(sum(a * a for a in left)) or 1.0
        norm_r = math.sqrt(sum(b * b for b in right)) or 1.0
        return dot / (norm_l * norm_r)
