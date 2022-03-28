const semanticRelease = require('semantic-release');
const editJsonFile = require("edit-json-file");

async function main() {
    try {
        const result = await semanticRelease({plugins: ["@semantic-release/commit-analyzer"]});
        const nextVersion = result.nextRelease.nextVersion;

        let file = editJsonFile(`${__dirname}/package.json`);

        console.log("Updating package.json version...");
        file.set("version", nextVersion);
        file.save();

        console.log("Updating plugin.json version...");
        file = editJsonFile(`${__dirname}/src/plugin.json`);
        file.set("info.version", nextVersion);
        file.save();
    } catch (err) {
        console.error('Updating plugin version failed with %O', err);
    }
}

main();
