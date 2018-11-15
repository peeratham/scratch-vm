const getProgramXml = function () {
    let targets = "";
    const stageVariables = Scratch.vm.runtime.getTargetForStage().variables;
    for (let i = 0; i < Scratch.vm.runtime.targets.length; i++) {
        const currTarget = Scratch.vm.runtime.targets[i];
        const currBlocks = currTarget.blocks._blocks;
        const variableMap = currTarget.variables;
        const variables = Object.keys(variableMap).map(k => variableMap[k]);
        const xmlString = `<${currTarget.isStage ? "stage " : "sprite "} name="${currTarget.getName()}"><xml><variables>${variables.map(v => v.toXML()).join()}</variables>${currTarget.blocks.toXML()}</xml></${currTarget.isStage ? "stage" : "sprite"}>`;

        targets += xmlString;
    }
    var str = `<program>${targets}</program>`;
    str = str.replace(/\s+/g, ' '); // Keep only one space character
    str = str.replace(/>\s*/g, '>');  // Remove space after >
    str = str.replace(/\s*</g, '<');  // Remove space before <

    return str;
}

const ASSET_SERVER = 'https://cdn.assets.scratch.mit.edu/';
const PROJECT_SERVER = 'https://cdn.projects.scratch.mit.edu/';

/**
 * @param {Asset} asset - calculate a URL for this asset.
 * @returns {string} a URL to download a project file.
 */
const getProjectUrl = function (asset) {
    const assetIdParts = asset.assetId.split('.');
    const assetUrlParts = [PROJECT_SERVER, 'internalapi/project/', assetIdParts[0], '/get/'];
    if (assetIdParts[1]) {
        assetUrlParts.push(assetIdParts[1]);
    }
    return assetUrlParts.join('');
};

/**
 * @param {Asset} asset - calculate a URL for this asset.
 * @returns {string} a URL to download a project asset (PNG, WAV, etc.)
 */
const getAssetUrl = function (asset) {
    const assetUrlParts = [
        ASSET_SERVER,
        'internalapi/asset/',
        asset.assetId,
        '.',
        asset.dataFormat,
        '/get/'
    ];
    return assetUrlParts.join('');
};


const LOCAL_ASSET_SERVER = 'http://localhost:8000/';
const LOCAL_PROJECT_SERVER = 'http://localhost:8000/';
const getLocalProjectUrl = function (asset) {
    const assetIdParts = asset.assetId.split('.');
    const assetUrlParts = [LOCAL_PROJECT_SERVER, assetIdParts[0] + '/', 'project.json'];
    if (assetIdParts[1]) {
        assetUrlParts.push(assetIdParts[1]);
    }
    return assetUrlParts.join('');
};

const getLocalAssetUrl = function (asset) {
    const assetUrlParts = [
        LOCAL_ASSET_SERVER,
        location.hash.substring(1).split(",")[0] + '/',
        asset.assetId,
        '.',
        asset.dataFormat
    ];
    return assetUrlParts.join('');
};

const loadProject = function (projectInputDom) {
    let id = null;
    if(!location.hash.startsWith("#view")){
        id = location.hash.substring(1).split(',')[0];
        projectInputDom.value = id; //update to current id in hash    
    }else{
        id = projectInputDom.value;
    }
    
    Scratch.vm.downloadProjectId(id);
    return id;
};