#!/bin/bash

# Fetch the latest open PR branch from the spore-sdk repository
latest_pr_branch=$(curl -s "https://api.github.com/repos/sporeprotocol/spore-sdk/pulls" | jq -r '.[0].head.ref')

# Display the latest PR branch
echo "Latest PR branch: $latest_pr_branch"

# Clone the latest PR branch and name it spore-sdk
git clone --branch "$latest_pr_branch" --single-branch https://github.com/sporeprotocol/spore-sdk.git spore-sdk


# Step 1: Move spore-devconfig/localcfg.ts to spore-sdk/packages/core/src/config
mv spore-devconfig/localcfg.ts spore-sdk/packages/core/src/config/

# Step 2: Replace spore-devconfig/env.ts with spore-sdk/packages/core/src/__tests__/shared/env.ts
cp spore-devconfig/env.ts spore-sdk/packages/core/src/__tests__/shared/env.ts

rm -rf spore-devconfig

echo "Configuration files updated successfully!"

# Path to spore-sdk/package.json
package_json_path="spore-sdk/packages/core/package.json"

# Check if package.json file exists
if [ ! -f "$package_json_path" ]; then
  echo "Error: spore-sdk/package.json file not found."
  exit 1
fi

# Add "test:dev" script to package.json
if grep -q '"test:dev"' "$package_json_path"; then
  echo "Error: \"test:dev\" script already exists in package.json."
  exit 1
else
  # Use awk for more reliable text processing
  awk '/"test": "vitest",/ { print; print "    \"test:dev\": \"cross-env NODE_ENV=development vitest\","; next }1' "$package_json_path" > "$package_json_path.tmp"
  mv "$package_json_path.tmp" "$package_json_path"
  echo "The \"test:dev\" script has been added to package.json."
fi

# Path to spore-sdk/packages/core/package.json
core_package_json_path="spore-sdk/packages/core/package.json"

# Check if package.json file exists
if [ ! -f "$core_package_json_path" ]; then
  echo "Error: spore-sdk/packages/core/package.json not found."
  exit 1
fi

# Add "cross-env" dependency to spore-sdk/packages/core/package.json
if grep -q '"cross-env": "^7.0.3",' "$core_package_json_path"; then
  echo "Error: \"cross-env\" dependency already exists in spore-sdk/packages/core/package.json."
  exit 1
else
  # Use jq for JSON manipulation
  jq '.dependencies |= . + { "cross-env": "^7.0.3" }' "$core_package_json_path" > "$core_package_json_path.tmp"
  mv "$core_package_json_path.tmp" "$core_package_json_path"
  echo "\"cross-env\": \"^7.0.3\" dependency added to spore-sdk/packages/core/package.json."
fi

git clone https://github.com/Dawn-githup/spore_devenv.git

echo "The spore-sdk dev test environment was updated successfully！"
