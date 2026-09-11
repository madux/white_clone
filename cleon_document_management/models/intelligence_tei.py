# -*- coding: utf-8 -*-
import logging
import threading

_logger = logging.getLogger(__name__)

EMBED_MODEL = "Qwen/Qwen3-Embedding-0.6B"
RERANK_MODEL = "Qwen/Qwen3-Reranker-0.6B"
EMBED_DIM = 1024
QUERY_INSTRUCTION = (
    "Given a document search query, retrieve relevant passages that answer the query"
)

_lock = threading.Lock()
_embedder = None
_reranker = None
_embed_error = ""
_rerank_error = ""


def current_embed_model():
    return EMBED_MODEL


def _device():
    try:
        import torch

        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps"
        if torch.cuda.is_available():
            return "cuda"
    except Exception:
        pass
    return "cpu"


def _load_sentence_transformer(model_id):
    from sentence_transformers import SentenceTransformer

    try:
        return SentenceTransformer(
            model_id, device=_device(), local_files_only=True
        )
    except Exception:
        _logger.info("Local cache miss for %s; downloading from Hugging Face.", model_id)
        return SentenceTransformer(model_id, device=_device())


def _load_cross_encoder(model_id):
    from sentence_transformers import CrossEncoder

    try:
        return CrossEncoder(model_id, device=_device(), local_files_only=True)
    except TypeError:
        try:
            return CrossEncoder(model_id, device=_device())
        except Exception:
            return CrossEncoder(model_id)
    except Exception:
        _logger.info("Local cache miss for %s; downloading from Hugging Face.", model_id)
        try:
            return CrossEncoder(model_id, device=_device())
        except TypeError:
            return CrossEncoder(model_id)


def _get_embedder():
    global _embedder, _embed_error
    if _embedder is not None:
        return _embedder
    with _lock:
        if _embedder is not None:
            return _embedder
        _logger.info("Loading local embedding model %s on %s", EMBED_MODEL, _device())
        try:
            _embedder = _load_sentence_transformer(EMBED_MODEL)
            _embed_error = ""
        except Exception as error:
            _embed_error = str(error)
            raise
        return _embedder


def _get_reranker():
    global _reranker, _rerank_error
    if _reranker is not None:
        return _reranker
    with _lock:
        if _reranker is not None:
            return _reranker
        _logger.info("Loading local reranker %s on %s", RERANK_MODEL, _device())
        try:
            _reranker = _load_cross_encoder(RERANK_MODEL)
            _rerank_error = ""
        except Exception as error:
            _rerank_error = str(error)
            raise
        return _reranker


def embed_texts(texts, env=None, is_query=False):
    clean = [(text or "").strip() for text in texts if (text or "").strip()]
    if not clean:
        return []
    embedder = _get_embedder()
    kwargs = {
        "normalize_embeddings": True,
        "batch_size": 16,
        "show_progress_bar": False,
    }
    if is_query:
        try:
            vectors = embedder.encode(clean, prompt_name="query", **kwargs)
        except Exception:
            instructed = [
                "Instruct: %s\nQuery:%s" % (QUERY_INSTRUCTION, text) for text in clean
            ]
            vectors = embedder.encode(instructed, **kwargs)
    else:
        vectors = embedder.encode(clean, **kwargs)
    return [list(map(float, row)) for row in vectors]


def rerank_texts(query, texts, env=None):
    clean = [(text or "").strip() or " " for text in texts]
    if not clean:
        return []
    if len(clean) == 1:
        return [0]
    reranker = _get_reranker()
    pairs = [((query or "").strip(), text) for text in clean]
    scores = reranker.predict(pairs, show_progress_bar=False)
    ranked = sorted(
        range(len(clean)),
        key=lambda index: float(scores[index]),
        reverse=True,
    )
    return ranked


def _libraries_ok():
    try:
        import sentence_transformers  # noqa: F401
        import torch  # noqa: F401

        return True, ""
    except Exception as error:
        return False, str(error)


def _model_cached(model_id):
    try:
        from huggingface_hub import try_to_load_from_cache

        return bool(
            try_to_load_from_cache(model_id, "config.json")
            or try_to_load_from_cache(model_id, "model.safetensors")
        )
    except Exception:
        return False


def embed_health(env=None):
    libraries_ok, library_error = _libraries_ok()
    embed_cached = _model_cached(EMBED_MODEL)
    rerank_cached = _model_cached(RERANK_MODEL)
    return {
        "embedding_model": EMBED_MODEL,
        "rerank_model": RERANK_MODEL,
        "embed_ok": libraries_ok and (_embedder is not None or embed_cached),
        "rerank_ok": libraries_ok and (_reranker is not None or rerank_cached),
        "embed_loaded": _embedder is not None,
        "rerank_loaded": _reranker is not None,
        "embed_cached": embed_cached,
        "rerank_cached": rerank_cached,
        "libraries_ok": libraries_ok,
        "embed_error": _embed_error or library_error,
        "rerank_error": _rerank_error or library_error,
        "device": _device() if libraries_ok else "",
    }
