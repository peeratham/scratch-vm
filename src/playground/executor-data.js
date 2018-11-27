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
    console.log(response);
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


window.onload = function () {
    const projectIdDom = document.getElementById("projectId");
    let projectId = projectIdDom.innerText = location.hash.substring(1, location.hash.length);
    configureProjectResourceUrl({LOCAL_ASSET:true});
    loadProjectAndRunTask(
        projectId,
        createUploadTask(projectId, function () { updateStatus(projectId, 'DATA', 'COMPLETE') }));
};

