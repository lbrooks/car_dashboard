#!/bin/bash

find . -name "*.js" -o -name "*.json" -o -name "*.html" -o -name "*.sh" | tar cvfz car_dashboard.tar.gz -T -
