#!/bin/bash
# https://extensions.gnome.org/extension/657/shelltile/
if [ -z "$1" ]; then

	zip -r ShellTile@emasab.it.zip *.js *.json *.css schemas/ locale/ -x *.pot -x *.po
	

elif [ "$1" = "pot" ]; then
	
	xgettext -k_ -kN_ -o locale/shelltile.pot *.js		

elif [ "$1" = "mo" ]; then

	find . | egrep '\.po$' | while read line; do msgfmt -o $(echo $line | sed 's/\.po$/\.mo/g') ${line}; done

fi
