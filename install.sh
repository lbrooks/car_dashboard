#!/bin/bash

type -P "npm" &>/dev/null || { echo  "npm not found, run: npm install -g npm"; exit 1; }
npm install

type -P "bower" &>/dev/null || { echo  "bower not found, run: npm install -g bower"; exit 1; }
bower install
