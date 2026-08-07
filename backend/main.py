from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.chat.router import router as chat_router
from api.diff.router import router as diff_router
from api.graph.router import router as graph_router
from api.notes.agentic_search import router as agentic_search_router
from api.notes.complete import router as complete_router
from api.notes.notes import router as notes_router
from api.notes.search import router as search_router
from api.notes.transform import router as transform_router
from api.vault.router import router as vault_router
from api.vault.upload import router as upload_router
from config import get_settings, is_anthropic_configured, is_tavily_configured
from vault_config import get_vault_path, set_vault_path

logger = logging.getLogger("digital_garden")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    if not is_anthropic_configured(settings):
        logger.warning(
            "ANTHROPIC_API_KEY is missing or still a placeholder. "
            "Add your key to backend/.env before using chat or AI features."
        )
    else:
        logger.info("Anthropic API key configured.")

    if is_tavily_configured(settings):
        logger.info("Tavily API key configured (web search enabled).")
    else:
        logger.warning(
            "TAVILY_API_KEY not set. Web search tool will fail until you add it to backend/.env."
        )

    vault = get_vault_path()
    if vault is None and settings.vault_path:
        expanded = settings.vault_path.expanduser()
        expanded.mkdir(parents=True, exist_ok=True)
        set_vault_path(expanded)
        vault = expanded
        logger.info("Initialized vault at %s", vault)
    elif vault:
        logger.info("Vault configured at %s", vault)
    else:
        logger.warning("No vault configured. Set VAULT_PATH in backend/.env or use PUT /vault/path.")

    yield


app = FastAPI(title="Digital Garden API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vault_router)
app.include_router(upload_router)
app.include_router(graph_router)
app.include_router(agentic_search_router)
app.include_router(search_router)   # must be before notes_router (avoids /{path} catch-all)
app.include_router(transform_router) # must be before notes_router
app.include_router(complete_router)  # must be before notes_router
app.include_router(notes_router)
app.include_router(diff_router)
app.include_router(chat_router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "ai": {
            "anthropic_configured": is_anthropic_configured(),
            "tavily_configured": is_tavily_configured(),
        },
    }
