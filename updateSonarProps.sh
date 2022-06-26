#!/usr/bin/env bash
#title          : updateSonarProps.sh
#description    :
# This script parses the project's name and version from its package.json and automagically
# updates the version and package name in the SonarQube configuration properties file.
# It can be used as a pre step before running the sonar-scanner command
#
#prerequisites  : NodeJS based project with package.json, sonar*.properties file in the cwd
#author         : Christian-André Giehl <christian@emailbrief.de>
#modified by    : Daniel Duarte <danieldd.ar@gmail.com>
#date           : 20180220
#version        : 1.1
#usage          : sh updateSonarProps.sh
#==============================================================================
echo "Updating the SonarQube properties..."

# Get the project name from package.json
PACKAGE_NAME=$(cat package.json \
  | grep name \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')
echo "Project: ${PACKAGE_NAME}"

# Get the version from package.json
PACKAGE_VERSION=$(cat package.json \
  | grep version \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')
echo "Version: ${PACKAGE_VERSION}"

# Get the Sonar properties file
SONAR_FILE=$(find . -iname sonar*.properties -type f)
echo "Sonar file: ${SONAR_FILE}"

SED_EXTRA_OPTS="-i.bak"

# Update the version
REPLACE='^sonar.projectVersion=.*$'
WITH="sonar.projectVersion=${PACKAGE_VERSION}"
sed $SED_EXTRA_OPTS -e "s/${REPLACE}/${WITH}/g" ${SONAR_FILE}

# Update the project name
REPLACE='^sonar.projectName=.*$'
WITH="sonar.projectName=${PACKAGE_NAME}"
sed $SED_EXTRA_OPTS -e "s/${REPLACE}/${WITH}/g" ${SONAR_FILE}
