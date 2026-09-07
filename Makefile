# soHelper - budowanie i pakowanie.
# `make` bez argumentu wypisuje liste celow.

SHELL := /bin/bash
BUILDER := ./node_modules/.bin/electron-builder
REPO := DamianGierlowski/SoHelper

.DEFAULT_GOAL := help
.PHONY: help install dev start check typecheck test build mac win dist bump release clean distclean

help: ## Ta lista
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "  Paczki laduja w release/. Pierwsze budowanie na nowa platforme"
	@echo "  sciaga binarke Electrona (~100 MB na platforme) i chwile trwa."

install: ## Instalacja zaleznosci
	npm install

dev: ## Dev z HMR
	npm run dev

start: ## Podglad buildu produkcyjnego
	npm run build && npm start

typecheck: ## Sprawdzenie typow (vite ich NIE sprawdza)
	npm run typecheck

test: ## Testy warstwy danych
	npm run test:db

check: typecheck test ## Typy + testy

build: ## Kompilacja do out/
	npm run build

mac: check build ## Paczka macOS, tylko lokalnie (.dmg + .zip, arm64 i x64)
	$(BUILDER) --mac

win: check build ## Paczka Windows (instalator .exe + .zip, x64)
	$(BUILDER) --win

dist: check build ## Obie platformy naraz
	$(BUILDER) --mac --win

bump: ## Podnosi wersje patch w package.json (0.0.1 -> 0.0.2)
	npm version patch --no-git-tag-version

release: check build ## Buduje i wysyla wydanie Windows na GitHub Releases
	@rm -rf release
	$(BUILDER) --win --publish never
	@version=$$(node -p "require('./package.json').version"); \
	gh release create "v$$version" \
		"release/soHelper-$$version.exe" \
		"release/soHelper-$$version.exe.blockmap" \
		release/latest.yml \
		--repo $(REPO) \
		--target "$$(git rev-parse HEAD)" \
		--title "$$version" \
		--generate-notes \
		--draft
	@echo
	@echo "  Wydanie poszlo jako SZKIC. Dopoki go nie opublikujesz, electron-updater"
	@echo "  go NIE widzi:  gh release edit v<wersja> --draft=false -R $(REPO)"

clean: ## Usuwa out/ i release/
	rm -rf out release

distclean: clean ## To co clean + node_modules
	rm -rf node_modules
