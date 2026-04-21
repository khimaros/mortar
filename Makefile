VSIX := mortar.vsix
PNG  := resources/logo.png
SVG  := resources/logo.svg

.PHONY: all deps compile watch lint test precommit package clean

all: package

deps:
	npm install

compile:
	npm run compile

watch:
	npm run watch

lint:
	npm run lint

test:
	npm run test

precommit:
	npm run precommit

$(PNG): $(SVG)
	inkscape $(SVG) --export-type=png --export-filename=$(PNG) -w 256 -h 256

package: compile $(PNG)
	npx --yes @vscode/vsce package --out $(VSIX)

clean:
	rm -rf out $(VSIX)
