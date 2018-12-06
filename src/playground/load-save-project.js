
var app = angular.module('loadSaveEditorApp', []);

app.controller('loadSaveEditorController', async function ($scope, $http) {
    let projectId = location.hash.substring(1, location.hash.length);
    $scope._id = projectId;
});

window.onhashchange = function () {
    location.reload();
};

const serverUrl = 'http://localhost:3000/project-data';
const sendReqToSave = async function (projectId, sb3File, xml) {
    var formData = new FormData();
    formData.append('_id', projectId);
    formData.append('sb3', sb3File);
    formData.append('xml', xml);
    const response = await fetch(serverUrl, {
        method: "POST",
        mode: "cors",
        cache: "no-cache",
        body: formData
    });

    return response;
};

const createUploadTask = function (projectId, callback) {
    return async function () {
        const downloadLink = document.createElement('a');
        document.body.appendChild(downloadLink);
        const xml = await new Promise(function (resolve, reject) {
            resolve(getProgramXml());
        });
        Scratch.vm.saveProjectSb3().then(content => {
            const url = window.URL.createObjectURL(content);
            downloadLink.href = url;
            downloadLink.download = "filename";
            return sendReqToSave(projectId, content, xml);
        }).then(() => callback());
    };
}



window.onload = async function () {
    const projectIdTextInput = document.getElementById("projectId");
    let projectId = projectIdTextInput.value;
    let dataStat = await fetch(`http://localhost:3000/data/${projectId}`).then(res => res.json());
    configureProjectResourceUrl({LOCAL_ASSET:dataStat.project_dir_exists});
    
//     let wsReadyCallback = createUploadTask(projectId, function () { updateStatus(projectId, 'DATA', 'COMPLETE') });
    const vm = new window.VirtualMachine();
    setupAnalysisUI({ vm });
    loadProjectAndRunTask({
        providedVM: vm,
        projectId,
        wsReadyCallback: ()=>{},
        requiredAnalysisUi:false
    });
};

const saveButton = document.getElementById("save");
saveButton.addEventListener("click", function(){
    const projectIdTextInput = document.getElementById("projectId");
    let projectId = projectIdTextInput.value;
    createUploadTask(projectId, function () { 
        const statusDom = document.getElementById("status");
        statusDom.innerText = "Project Saved!";
    })();
});


const greenFlagButton = document.getElementById("greenFlag");
greenFlagButton.addEventListener("click", function(){
    Scratch.vm.start();
    Scratch.vm.greenFlag();
});

const stopAllButton = document.getElementById("stopAll");
stopAllButton.addEventListener("click", function(){
    Scratch.vm.stopAll();
    clearTimeout(Scratch.vm.runtime._steppingInterval);
});

const addTargetButton = document.getElementById("addTargetButton");
addTargetButton.addEventListener("click", function(){
    // Scratch.vm
    console.log('TODO: add target');
    let emptyItem = emptySprite("New sprite");
    Scratch.vm.addSprite(JSON.stringify(emptyItem)).then(() => {
        setTimeout(() => { 
            //things to do after switch to a new target
        });
    });
});

const renameButton = document.getElementById("renameTargetButton");
const targetNameTextInput = document.getElementById("targetName");
renameButton.addEventListener("click", function(){
    Scratch.vm.renameSprite(Scratch.vm.editingTarget.id, targetNameTextInput.value);
})

const emptySprite = (name) => ({
    objName: name,
    sounds: [
    ],
    costumes: [
        {
            costumeName: 'default costume',
            baseLayerID: -1,
            baseLayerMD5: 'cd21514d0531fdffb22204e0ec5ed84a.svg',
            bitmapResolution: 1,
            rotationCenterX: 0,
            rotationCenterY: 0
        }
    ],
    currentCostumeIndex: 0,
    scratchX: 36,
    scratchY: 28,
    scale: 1,
    direction: 90,
    rotationStyle: 'normal',
    isDraggable: false,
    visible: true,
    spriteInfo: {}
});