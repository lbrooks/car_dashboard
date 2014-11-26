#!/bin/bash

if [ $# -ne 4 ]; then
	echo "Usage: ./run.sh <hostname> <database> <username> <password>";
	exit 1;
else
	node app.js --host="$1" --database="$2" --user="$3" --password="$4"
fi
