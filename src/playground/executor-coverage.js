
window.onhashchange = function () {
    location.reload();
};
const saveAnalysisInfo = async function (projectId) {
    let info = {
        '_id': projectId,
        'green_flag_coverage': Math.floor(Math.random() * 100)
    }
    
    const response = await fetch(serverUrl, {
        method: "POST",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        mode: "cors",
        cache: "no-cache",
        body: JSON.stringify(info)
    });
    console.log(response);
    return response;
};

const createCoverageTask = function(projectId, callback){
    return async function(){
        await saveAnalysisInfo(projectId);
        setTimeout(callback(), 2000);
    }
}

const serverUrl = 'http://localhost:3000/analysis-infos';


window.onload = function(){
    const projectIdDom = document.getElementById("projectId");
    let projectId = projectIdDom.innerText = location.hash.substring(1,location.hash.length);
    loadProjectAndRunTask(
        projectId,
        createCoverageTask(projectId, function () { updateStatus(projectId, 'COVERAGE', 'COMPLETE') }));
}

