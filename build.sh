#!/bin/bash
# https://extensions.gnome.org/extension/657/shelltile/
if [ -z "$1" ]; then

    zip -r ShellTile@emasab.it.zip *.js metadata.json *.css schemas/ locale/ -x *.pot -x *.po
	

elif [ "$1" = "pot" ]; then
	
    xgettext -k_ -kN_ -o locale/shelltile.pot *.js
    for pofile in $(find locale -mindepth 2 | egrep .po); do
        msgmerge -o $pofile.new $pofile locale/shelltile.pot
        mv $pofile.new $pofile
    done

elif [ "$1" = "mo" ]; then

    find . | egrep '\.po$' | while read line; do msgfmt -o $(echo $line | sed 's/\.po$/\.mo/g') ${line}; done

elif [ "$1" = "schemas" ]; then


glib-compile-schemas schemas/

elif [ "$1" = "eslint" ]; then

npx eslint . --fix

fi