#!/bin/bash

# Check if the AWS CLI is in the PATH
found=$(which aws)
if [ -z "$found" ]; then
  echo "Please install the AWS CLI under your PATH: http://aws.amazon.com/cli/"
  exit 1
fi

# Check if jq is in the PATH
found=$(which jq)
if [ -z "$found" ]; then
  echo "Please install jq under your PATH: http://stedolan.github.io/jq/"
  exit 1
fi

# Read other configuration from config.json
AWS_ACCOUNT_ID=$(jq -r '.AWS_ACCOUNT_ID' config.json)
REGION=$(jq -r '.REGION' config.json)

# Updating Lambda functions
for f in $(ls -1); do
  if [[ $f != Lambda* ]]; then
    continue
  fi
  echo "Updating function $f begin..."
	cp config.json $f/
  cd $f

  zip -r $f.zip index.js config.json node_modules
  aws lambda update-function-code --function-name ${f} --zip-file fileb://${f}.zip 
	rm config.json
	rm $f.zip
  cd ..
  echo "Updating function $f end"
done

