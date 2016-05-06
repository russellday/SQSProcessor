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

cd iam

# Create IAM Roles for Lambda Function
for f in $(ls -1 Lambda*); do
  role="${f%.*}"
  echo "Creating role $role from $f begin..."
	trust="trust_policy_lambda.json"
  aws iam create-role --role-name $role --assume-role-policy-document file://$trust
  aws iam update-assume-role-policy --role-name $role --policy-document file://$trust
  aws iam put-role-policy --role-name $role --policy-name $role --policy-document file://$f
  echo "Creating role $role end"
done

cd ..

# Create Lambda Functions
for f in $(ls -1|grep ^Lambda); do
  echo "Creating function $f begin..."
  cp config.json $f/
  cd $f
  zip -r $f.zip index.js config.json node_modules
  aws lambda create-function --function-name ${f} \
      --runtime nodejs4.3 \
      --role arn:aws:iam::$AWS_ACCOUNT_ID:role/${f} \
      --handler index.handler \
      --zip-file fileb://${f}.zip \
      --timeout 30
	sleep 1 # To avoid errors
  cd ..
  echo "Creating function $f end"
done

./deploy.sh

