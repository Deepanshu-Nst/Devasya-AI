"""
GitHub adapter — wraps GitHub REST API for repo data retrieval.
"""
import logging
from typing import Dict, Any, Optional
import httpx

logger = logging.getLogger(__name__)

GITHUB_API_BASE = "https://api.github.com"


async def fetch_repo_info(repo_url: str, token: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetch basic info about a GitHub repository.

    Args:
        repo_url: Full GitHub URL like https://github.com/owner/repo
        token: Optional GitHub personal access token for higher rate limits.

    Returns:
        Dict with repo metadata and README content.
    """
    # Parse owner/repo from URL
    parts = repo_url.rstrip("/").split("/")
    if len(parts) < 2:
        raise ValueError(f"Cannot parse owner/repo from URL: {repo_url}")
    owner, repo = parts[-2], parts[-1]

    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    async with httpx.AsyncClient(timeout=20.0) as client:
        # Repo metadata
        repo_resp = await client.get(
            f"{GITHUB_API_BASE}/repos/{owner}/{repo}", headers=headers
        )
        if repo_resp.status_code == 404:
            raise ValueError(f"Repository not found: {repo_url}")
        repo_resp.raise_for_status()
        repo_data = repo_resp.json()

        # README content
        readme_text = ""
        try:
            readme_resp = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{repo}/readme", headers=headers
            )
            if readme_resp.status_code == 200:
                import base64
                readme_raw = readme_resp.json().get("content", "")
                if readme_raw:
                    readme_text = base64.b64decode(readme_raw).decode("utf-8", errors="replace")
        except Exception as e:
            logger.warning(f"Could not fetch README: {e}")

        # Languages
        lang_resp = await client.get(
            f"{GITHUB_API_BASE}/repos/{owner}/{repo}/languages", headers=headers
        )
        languages = list(lang_resp.json().keys()) if lang_resp.status_code == 200 else []

    return {
        "name": repo_data.get("name"),
        "description": repo_data.get("description", ""),
        "stars": repo_data.get("stargazers_count", 0),
        "forks": repo_data.get("forks_count", 0),
        "language": repo_data.get("language", ""),
        "languages": languages,
        "topics": repo_data.get("topics", []),
        "open_issues": repo_data.get("open_issues_count", 0),
        "size_kb": repo_data.get("size", 0),
        "created_at": repo_data.get("created_at", ""),
        "updated_at": repo_data.get("updated_at", ""),
        "readme": readme_text[:3000],  # Cap to first 3000 chars for LLM context
        "url": repo_url,
    }
