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
    let id = location.hash.substring(1).split(',')[0];
    projectInputDom.value = id; //update to current id in hash
    Scratch.vm.downloadProjectId(id);
    return id;
};

/**
 * Render previously run benchmark data.
 * @param {object} json data from a previous benchmark run.
 */
const renderBenchmarkData = function (json) {
    const vm = new window.VirtualMachine();
    new ProfilerRun({ vm }).render(json);
    setShareLink(json);
};





//debugging utitlity
const xmlButton = document.getElementById('getTargetXml');
xmlButton.addEventListener("click", function () {
    let xml = Scratch.vm.editingTarget.blocks.toXML();
    let str = xml.replace(/\s+/g, ' '); // Keep only one space character
    str = str.replace(/>\s*/g, '>');  // Remove space after >
    str = str.replace(/\s*</g, '<');  // Remove space before <
    str = str.replace(/"/g, "'");   //replace double quotes with single quotes
    console.log(str);
});

const blockXmlButton = document.getElementById('getBlockXml');
blockXmlButton.addEventListener("click", function () {
    if(Blockly.selected){
        let block = Blockly.selected;
        let dom = Blockly.Xml.blockToDom(block);
        let xml = Blockly.Xml.domToText(dom);
        let str = xml.replace(/\s+/g, ' '); // Keep only one space character
        str = str.replace(/>\s*/g, '>');  // Remove space after >
        str = str.replace(/\s*</g, '<');  // Remove space before <
        str = str.replace(/"/g, "'"); //replace double quotes with single quotes
        console.log(str);
    }
});

const blockIdToFocusInputBox = document.getElementById('blockIdToFocusTextInput');
const centerOnBlockButton = document.getElementById('centerOnBlockButton');
centerOnBlockButton.addEventListener("click", function(){
    let id = blockIdToFocusInputBox.value;
    Blockly.getMainWorkspace().centerOnBlock(id);
    setTimeout(function(){
        Blockly.getMainWorkspace().reportValue(id,id);
    },500)
});

const cleanUpButton = document.getElementById("cleanup");
cleanUpButton.addEventListener("click", function(){
    Scratch.workspace.cleanUp();
});

const greenFlagButton = document.getElementById("greenFlag");
greenFlagButton.addEventListener("click", function(){
    Scratch.vm.runtime.start();
    Scratch.vm.runtime.greenFlag();
});

const stopButton = document.getElementById("stop");
stopButton.addEventListener("click", function(){
    Scratch.vm.stopAll();
});

function taChange() {
    var textarea = document.getElementById('importExport');
    if (sessionStorage) {
      sessionStorage.setItem('textarea', textarea.value)
    }
    var valid = true;
    try {
      Blockly.Xml.textToDom(textarea.value);
    } catch (e) {
      valid = false;
    }
    document.getElementById('import').disabled = !valid;
}

function toXml() {
    var output = document.getElementById('importExport');
    var xml = Blockly.Xml.workspaceToDom(Scratch.workspace);
    output.value = Blockly.Xml.domToPrettyText(xml);
    output.focus();
    output.select();
    taChange();
}

function fromXml() {
    var input = document.getElementById('importExport');
    var xml = Blockly.Xml.textToDom(input.value);
    Blockly.Xml.domToWorkspace(xml, Scratch.workspace);
    taChange();
}


