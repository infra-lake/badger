.DEFAULT_GOAL := up

.PHONY: up
up: down check
	@docker compose -f ./.docker/docker-compose.yaml --env-file .env up --build -d

.PHONY: down
down:
	@docker compose -f ./.docker/docker-compose.yaml --env-file .env down -v

.PHONY: check
check:
	@docker compose -f ./.docker/docker-compose.yaml --env-file .env config

.PHONY: logs
logs:
	@docker compose -f ./.docker/docker-compose.yaml --env-file .env logs $(watch) -f