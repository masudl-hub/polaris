# ─────────────────────────────────────────────────────────────
# Polaris — Test Runner
# ─────────────────────────────────────────────────────────────

PYTHON = .venv/bin/python
PYTEST = .venv/bin/pytest
BACKEND = backend

.PHONY: test test-unit test-integration test-models test-nlp test-vision test-trends test-api test-stream test-coverage test-frontend fixtures help

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Backend Tests ─────────────────────────────────────────────

test: ## Run all backend tests
	cd $(BACKEND) && $(PYTEST) tests/ -v

test-unit: ## Run only fast unit tests (no model loading)
	cd $(BACKEND) && $(PYTEST) tests/test_models.py -v

test-models: ## Run Pydantic model validation tests
	cd $(BACKEND) && $(PYTEST) tests/test_models.py -v

test-nlp: ## Run NLP pipeline tests (loads spaCy, RoBERTa, GloVe)
	cd $(BACKEND) && $(PYTEST) tests/test_nlp.py -v

test-vision: ## Run vision pipeline tests (mocked Gemini)
	cd $(BACKEND) && $(PYTEST) tests/test_vision.py -v

test-trends: ## Run trend analysis + SEM tests (mocked pytrends)
	cd $(BACKEND) && $(PYTEST) tests/test_trends.py -v

test-api: ## Run API endpoint integration tests
	cd $(BACKEND) && $(PYTEST) tests/test_api.py -v

test-stream: ## Run SSE streaming endpoint tests
	cd $(BACKEND) && $(PYTEST) tests/test_api_stream.py -v

test-integration: ## Run all integration tests (loads ML models)
	cd $(BACKEND) && $(PYTEST) tests/test_api.py tests/test_api_stream.py -v

test-coverage: ## Run all tests with coverage report
	cd $(BACKEND) && $(PYTEST) tests/ -v --cov=. --cov-report=term-missing --cov-report=html:htmlcov

# ── Frontend Tests ────────────────────────────────────────────

test-frontend: ## Run frontend tests (vitest)
	cd frontend-react && npx vitest run

# ── Full Suite ────────────────────────────────────────────────

test-all: test test-frontend ## Run backend + frontend tests

# ── Utilities ─────────────────────────────────────────────────

fixtures: ## Regenerate test fixture files (image, video)
	$(PYTHON) $(BACKEND)/tests/gen_fixtures.py
