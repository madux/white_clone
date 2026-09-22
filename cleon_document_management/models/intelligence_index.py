import json
import logging
import math
import re

from odoo import api, fields, models

from .intelligence_tei import EMBED_DIM, current_embed_model, embed_texts, rerank_texts

_logger = logging.getLogger(__name__)

RRF_K = 60
RETRIEVE_K = 24


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


def _ensure_retrieval_schema(cr, table, hnsw_name, gin_name):
    cr.execute("CREATE EXTENSION IF NOT EXISTS vector")
    cr.execute(
        """
        SELECT format_type(a.atttypid, a.atttypmod)
        FROM pg_attribute a
        JOIN pg_class c ON a.attrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE c.relname = %s
          AND n.nspname = current_schema()
          AND a.attname = 'embedding'
          AND NOT a.attisdropped
        """,
        (table,),
    )
    row = cr.fetchone()
    expected = "vector(%s)" % EMBED_DIM
    if not row or row[0] != expected:
        cr.execute("DROP INDEX IF EXISTS %s" % hnsw_name)
        cr.execute("ALTER TABLE %s DROP COLUMN IF EXISTS embedding" % table)
        cr.execute(
            "ALTER TABLE %s ADD COLUMN embedding vector(%s)" % (table, EMBED_DIM)
        )
    cr.execute(
        """
        CREATE INDEX IF NOT EXISTS %s
        ON %s
        USING hnsw (embedding vector_cosine_ops)
        """
        % (hnsw_name, table)
    )
    cr.execute(
        "ALTER TABLE %s ADD COLUMN IF NOT EXISTS search_tsv tsvector" % table
    )
    cr.execute(
        """
        CREATE INDEX IF NOT EXISTS %s
        ON %s
        USING gin (search_tsv)
        """
        % (gin_name, table)
    )
    cr.execute(
        """
        UPDATE %s
        SET search_tsv = to_tsvector('english', COALESCE(content, ''))
        WHERE search_tsv IS NULL
        """
        % table
    )


def _rrf(*ranked_id_lists):
    scores = {}
    for ranked in ranked_id_lists:
        for rank, chunk_id in enumerate(ranked, start=1):
            scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (RRF_K + rank)
    return [
        chunk_id
        for chunk_id, _score in sorted(
            scores.items(), key=lambda item: item[1], reverse=True
        )
    ]


def _keyword_ids(chunks, question):
    words = set(re.findall(r"[a-z0-9]{3,}", (question or "").lower()))
    ranked = []
    for chunk in chunks:
        hay = set(re.findall(r"[a-z0-9]{3,}", (chunk.content or "").lower()))
        score = (len(words & hay) / len(words)) if words else 0.0
        if score > 0:
            ranked.append((score, chunk.id))
    ranked.sort(key=lambda item: item[0], reverse=True)
    return [chunk_id for _score, chunk_id in ranked]


def _dense_ids(chunks, question, limit):
    try:
        query_vector = (embed_texts([question], env=chunks.env, is_query=True) or [[]])[0]
    except Exception as error:
        _logger.warning("Query embedding failed: %s", error)
        return []
    if not query_vector:
        return []
    literal = "[" + ",".join("%.8f" % float(value) for value in query_vector) + "]"
    try:
        chunks.env.cr.execute(
            """
            SELECT id
            FROM %s
            WHERE id = ANY(%%s)
              AND embedding IS NOT NULL
            ORDER BY embedding <=> %%s::vector
            LIMIT %%s
            """
            % chunks._table,
            (chunks.ids, literal, limit),
        )
        ids = [row[0] for row in chunks.env.cr.fetchall()]
        if ids:
            return ids
    except Exception as error:
        _logger.debug("pgvector search failed, using python cosine: %s", error)
    scored = []
    for chunk in chunks:
        vector = json.loads(chunk.embedding_json or "[]")
        if not vector or len(vector) != len(query_vector):
            continue
        scored.append((_cosine(query_vector, vector), chunk.id))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [chunk_id for _score, chunk_id in scored[:limit]]


def _sparse_ids(chunks, question, limit):
    query = (question or "").strip()
    if not query:
        return []
    try:
        chunks.env.cr.execute(
            """
            SELECT id
            FROM %s
            WHERE id = ANY(%%s)
              AND search_tsv IS NOT NULL
              AND search_tsv @@ plainto_tsquery('english', %%s)
            ORDER BY ts_rank_cd(search_tsv, plainto_tsquery('english', %%s)) DESC
            LIMIT %%s
            """
            % chunks._table,
            (chunks.ids, query, query, limit),
        )
        ids = [row[0] for row in chunks.env.cr.fetchall()]
        if ids:
            return ids
    except Exception as error:
        _logger.debug("Full-text search failed: %s", error)
    return _keyword_ids(chunks, question)[:limit]


def _cosine(left, right):
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    norm_l = math.sqrt(sum(a * a for a in left)) or 1.0
    norm_r = math.sqrt(sum(b * b for b in right)) or 1.0
    return dot / (norm_l * norm_r)


def hybrid_retrieve(chunks, question, limit=8):
    if not chunks:
        return chunks.browse()
    pool = max(limit * 3, RETRIEVE_K)
    dense = _dense_ids(chunks, question, pool)
    sparse = _sparse_ids(chunks, question, pool)
    fused = _rrf(dense, sparse)
    if not fused:
        fused = chunks.ids[:pool]
    candidate_ids = fused[:pool]
    candidates = chunks.browse(candidate_ids)
    texts = [chunk.content or "" for chunk in candidates]
    try:
        order = rerank_texts(question, texts, env=chunks.env)
        ranked_ids = [
            candidates[index].id
            for index in order
            if 0 <= index < len(candidates)
        ]
        return chunks.browse(ranked_ids[:limit])
    except Exception as error:
        _logger.info("Rerank unavailable, using hybrid ranks: %s", error)
        return chunks.browse(candidate_ids[:limit])


def _write_retrieval(record, vector):
    record.embedding_json = json.dumps(vector or [])
    table = record._table
    if vector:
        literal = "[" + ",".join("%.8f" % float(value) for value in vector) + "]"
        try:
            record.env.cr.execute(
                """
                UPDATE %s
                SET embedding = %%s::vector,
                    search_tsv = to_tsvector('english', COALESCE(content, ''))
                WHERE id = %%s
                """
                % table,
                (literal, record.id),
            )
            return
        except Exception as error:
            _logger.debug("Could not store pgvector column: %s", error)
    try:
        record.env.cr.execute(
            """
            UPDATE %s
            SET search_tsv = to_tsvector('english', COALESCE(content, ''))
            WHERE id = %%s
            """
            % table,
            (record.id,),
        )
    except Exception as error:
        _logger.debug("Could not store full-text column: %s", error)


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
            _ensure_retrieval_schema(
                cr,
                "doc_intelligence_chunk",
                "doc_intelligence_chunk_embedding_hnsw",
                "doc_intelligence_chunk_tsv_gin",
            )
            cr.execute("RELEASE SAVEPOINT di_pgvector")
        except Exception as error:
            cr.execute("ROLLBACK TO SAVEPOINT di_pgvector")
            _logger.warning("pgvector is not available yet: %s", error)

    def _write_vector(self, vector):
        self.ensure_one()
        _write_retrieval(self, vector)

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
                    "embedding_model": current_embed_model(),
                }
            )
            if index < len(vectors):
                chunk._write_vector(vectors[index])
            else:
                chunk._write_vector([])
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
    def search_similar(self, question, limit=8, dataset_id=None):
        domain = []
        if dataset_id:
            domain.append(("record_id.dataset_id", "=", int(dataset_id)))
            domain.append(
                ("record_id.review_status", "not in", ["rejected"])
            )
        else:
            domain.append(
                ("record_id.review_status", "in", ["approved", "overridden"])
            )
        user = self.env.user
        is_admin = user.has_group("base.group_system") or user.has_group(
            "cleon_document_management.group_document_admin"
        )
        dataset = (
            self.env["doc.intelligence.dataset"].browse(int(dataset_id)).exists()
            if dataset_id
            else self.env["doc.intelligence.dataset"]
        )
        owns_dataset = bool(dataset and dataset.owner_id == user)
        if not is_admin and not owns_dataset:
            employee = user.employee_id
            domain.append(("employee_id", "=", employee.id if employee else 0))
        allowed = self.search(domain)
        if dataset_id and not allowed:
            records = self.env["doc.intelligence.record"].search(
                [
                    ("dataset_id", "=", int(dataset_id)),
                    ("review_status", "not in", ["rejected"]),
                ]
            )
            for record in records.filtered(lambda item: not item.chunk_ids):
                self.index_record(record)
            allowed = self.search(domain)
        return hybrid_retrieve(allowed, question, limit=limit)


class IntelligenceAskChunk(models.Model):
    _name = "doc.intelligence.ask.chunk"
    _description = "Ask chat source chunk"
    _order = "id"

    conversation_id = fields.Many2one(
        "doc.intelligence.conversation",
        required=True,
        ondelete="cascade",
        index=True,
    )
    source_id = fields.Many2one(
        "doc.intelligence.ask.source",
        required=True,
        ondelete="cascade",
        index=True,
    )
    page = fields.Integer(default=1)
    content = fields.Text(required=True)
    embedding_json = fields.Text()
    embedding_model = fields.Char()

    def init(self):
        cr = self.env.cr
        cr.execute("SAVEPOINT di_ask_pgvector")
        try:
            _ensure_retrieval_schema(
                cr,
                "doc_intelligence_ask_chunk",
                "doc_intelligence_ask_chunk_embedding_hnsw",
                "doc_intelligence_ask_chunk_tsv_gin",
            )
            cr.execute("RELEASE SAVEPOINT di_ask_pgvector")
        except Exception as error:
            cr.execute("ROLLBACK TO SAVEPOINT di_ask_pgvector")
            _logger.warning("Ask pgvector is not available yet: %s", error)

    def _write_vector(self, vector):
        self.ensure_one()
        _write_retrieval(self, vector)

    @api.model
    def index_source(self, source):
        source.ensure_one()
        source.chunk_ids.unlink()
        texts = _chunks_from_text(source.extracted_text or "")
        if not texts:
            texts = [
                "Attached file %s. No readable text was extracted from this file."
                % (source.name or "document")
            ]
        try:
            vectors = embed_texts(texts, env=self.env)
        except Exception as error:
            _logger.warning("Ask source embedding failed: %s", error)
            vectors = [[] for _ in texts]
        chunks = self.browse()
        for index, text in enumerate(texts):
            chunk = self.create(
                {
                    "conversation_id": source.conversation_id.id,
                    "source_id": source.id,
                    "page": index + 1,
                    "content": text,
                    "embedding_model": current_embed_model(),
                }
            )
            if index < len(vectors):
                chunk._write_vector(vectors[index])
            else:
                chunk._write_vector([])
            chunks |= chunk
        return chunks

    @api.model
    def search_similar(self, question, conversation_id, limit=8):
        allowed = self.search([("conversation_id", "=", int(conversation_id or 0))])
        return hybrid_retrieve(allowed, question, limit=limit)


class IntelligenceLibraryChunk(models.Model):
    _name = "doc.intelligence.library.chunk"
    _description = "Ask library document chunk"
    _order = "id"

    document_id = fields.Many2one(
        "doc.document",
        required=True,
        ondelete="cascade",
        index=True,
    )
    page = fields.Integer(default=1)
    content = fields.Text(required=True)
    embedding_json = fields.Text()
    embedding_model = fields.Char()

    def _register_hook(self):
        super()._register_hook()
        from .intelligence_tei import preload_local_models

        preload_local_models(background=True)

    def init(self):
        cr = self.env.cr
        cr.execute("SAVEPOINT di_library_pgvector")
        try:
            _ensure_retrieval_schema(
                cr,
                "doc_intelligence_library_chunk",
                "doc_intelligence_library_chunk_embedding_hnsw",
                "doc_intelligence_library_chunk_tsv_gin",
            )
            cr.execute("RELEASE SAVEPOINT di_library_pgvector")
        except Exception as error:
            cr.execute("ROLLBACK TO SAVEPOINT di_library_pgvector")
            _logger.warning("Library pgvector is not available yet: %s", error)

    def _write_vector(self, vector):
        self.ensure_one()
        _write_retrieval(self, vector)

    @api.model
    def index_document(self, document):
        document.ensure_one()
        document.ask_chunk_ids.unlink()
        texts = _chunks_from_text(document.extracted_text or "")
        if not texts:
            return self.browse()
        vectors = embed_texts(texts, env=self.env)
        chunks = self.browse()
        for index, text in enumerate(texts):
            chunk = self.create(
                {
                    "document_id": document.id,
                    "page": index + 1,
                    "content": text,
                    "embedding_model": current_embed_model(),
                }
            )
            chunk._write_vector(vectors[index] if index < len(vectors) else [])
            chunks |= chunk
        return chunks

    @api.model
    def search_similar(self, question, limit=8):
        documents = self.env["doc.document"]._ask_library_documents()
        if not documents:
            return self.browse()
        allowed = self.sudo().search([("document_id", "in", documents.ids)])
        return hybrid_retrieve(allowed, question, limit=limit)
