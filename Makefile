COMPOSE_PROJECT_NAME=cms
BACKEND_SERVICE=backend

.PHONY: help up up-build down restart ps logs migrate makemigrations createsuperuser shell test lint format celery-ping health ws-echo-test
help:
	@echo "Targets:"
	@echo "  make up            -> docker compose up -d"
	@echo "  make up-build      -> docker compose up -d --build"
	@echo "  make down          -> docker compose down"
	@echo "  make logs          -> docker compose logs -f"
	@echo "  make migrate       -> backend: manage.py migrate"
	@echo "  make createsuperuser -> backend: manage.py createsuperuser"
	@echo "  make test          -> backend: pytest"
	@echo "  make lint          -> backend: flake8 + black --check + isort --check"
	@echo "  make celery-ping   -> celery call core.ping via worker"
	@echo "  make health        -> curl /api/health/ via nginx"

up:
	docker compose up -d

up-build:
	docker compose up -d --build

prod-up:
	docker compose -f docker-compose.prod.yml up --build -d

prod-down:
	docker compose -f docker-compose.prod.yml down

down:
	docker compose down

restart:
	docker compose restart

ps:
	docker compose ps

logs:
	docker compose logs -f --tail=200

migrate:
	docker compose exec $(BACKEND_SERVICE) python manage.py migrate --noinput

makemigrations:
	docker compose exec $(BACKEND_SERVICE) python manage.py makemigrations

createsuperuser:
	docker compose exec $(BACKEND_SERVICE) python manage.py createsuperuser

shell:
	docker compose exec $(BACKEND_SERVICE) python manage.py shell

test:
	docker compose exec $(BACKEND_SERVICE) pytest -q

lint:
	docker compose exec $(BACKEND_SERVICE) flake8 config apps
	docker compose exec $(BACKEND_SERVICE) black --check config apps
	docker compose exec $(BACKEND_SERVICE) isort --check-only config apps

format:
	docker compose exec $(BACKEND_SERVICE) black config apps
	docker compose exec $(BACKEND_SERVICE) isort config apps

celery-ping:
	docker compose exec $(BACKEND_SERVICE) python manage.py shell -c "from apps.core.tasks import ping; print(ping.delay().get(timeout=20))"

health:
	curl -sS http://localhost:8080/api/health/ ; echo

ws-echo-test:
	docker compose exec $(BACKEND_SERVICE) python -c "import asyncio,os; os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings.dev'); print('use a WS client against ws://localhost:8080/ws/echo/')"
