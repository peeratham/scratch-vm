/**
 * DUPEXPR ANALYSIS
 */

const analysis_data_endpoint_url = DUPEXPR_INFO_SERVICE_URL;

window.onhashchange = function () {
    location.reload();
};

const sendAnalysisRequest = async function ({ projectId, analysisType, evalMode }) {
    const url = "http://localhost:8080/discover";
    const xml = await getProjectXml(projectId);

    const analysisInfo = await fetch(url, {
        method: "POST",
        mode: "cors",
        cache: "no-cache",
        headers: {
            "Content-Type": "text/xml",
            "id": projectId,
            "type": analysisType,
            'evalMode': evalMode
        },
        body: xml,
    }).then(res => res.json());

    return analysisInfo;
};

const formatResult = function ({ projectId, analysisResult }) {
    let instanceMap = analysisResult.improvables.reduce((obj, item) => {
        if (item) { //ignore if undefined (data for the projectId not exists)
            obj[item.id] = item;
        }
        return obj;
    }, {});

    let result = {
        _id: projectId,
        instances: instanceMap,
        project_metrics: analysisResult.project_metrics,
        checkSetup: analysisResult.checkSetup
    };
    return result;
}

const getAnalysisInfo = async function ({ projectId, url, projectXml, analysisType, evalMode }) {
    let analysisResult = await sendAnalysisRequest({ projectId, url, projectXml, analysisType, evalMode });
    let formatted = formatResult({ projectId, analysisResult });

    return formatted;
}

const getProjectXml = async function (id) {
    let xml = await fetch(`${PROJECT_DATA_SERVICE_URL}/${id}/project.xml`).then(resp => resp.text());
    return xml;
}

const setupAndRunProfiler = async function ({ instance_id, analysisInfo }) {
    let updatedInstanceInfos = analysisInfo['instances'];
    let currentInstanceInfo = updatedInstanceInfos[instance_id];
    console.log('TODO: setup or apply transformation/invariant checks');

    let profilerRun = Scratch.ProfileRun = new ProfilerRun({
        vm: Scratch.vm, warmUpTime: 0, maxRecordedTime: 5000, projectId: Project.ID, initialReport: {},
        coverageInfo: currentInstanceInfo.coverageInfo
    });
    await profilerRun.runProfiler();

    console.log('TODO: record safety info');
    let safetyInfo = { 'failed_invariant': false, 'failed_loc': [] };

    updatedInstanceInfos[instance_id] = { ...currentInstanceInfo, ...safetyInfo };
    delete updatedInstanceInfos[instance_id].transforms;    // remove transforms from the final result (only save the loc of instance);
    delete updatedInstanceInfos[instance_id].invariants;

    let result = {
        '_id': analysisInfo._id,
        'analysis_name': 'dupexpr',
        'info': {
            'project_metrics': analysisInfo['project_metrics'],
            'instances': updatedInstanceInfos
        }
    };

    return result;
}

const createAnalysisTask = function (vm, projectId, callback) {
    return async function () {
        let projectXml = await getProjectXml(projectId);
        //project metric info
        console.log('TODO: getAnalysisInfo from improvement discovery url');
        let analysisInfo = await getAnalysisInfo({
            projectId, url: `${COVERAGE_ANALYSIS_SERVICE_URL}/${projectId}`, projectXml,
            analysisType: "duplicate-expression", evalMode: true
        });

        for (let instance_id of Object.keys(analysisInfo.instances)) {
            let updatedAnalysisInfo = await setupAndRunProfiler({ providedVM: vm, instance_id, analysisInfo });
            console.log('TODO: uncomment this to save');
            // await saveAnalysisInfo({info:updatedAnalysisInfo, analysis_data_endpoint_url});

            setTimeout(callback(), 2000);
        }
    }
}

const setupAnalysisUI = ({ vm }) => {
    vm.on('targetsUpdate', data => {
        // Clear select box.
        while (selectedTarget.firstChild) {
            selectedTarget.removeChild(selectedTarget.firstChild);
        }
        // Generate new select box.
        for (let i = 0; i < data.targetList.length; i++) {
            const targetOption = document.createElement('option');
            targetOption.setAttribute('value', data.targetList[i].id);
            // If target id matches editingTarget id, select it.
            if (data.targetList[i].id === data.editingTarget) {
                targetOption.setAttribute('selected', 'selected');
            }
            targetOption.appendChild(
                document.createTextNode(data.targetList[i].name)
            );
            selectedTarget.appendChild(targetOption);
        }
    });

    const selectedTarget = document.getElementById('selectedTarget');
    selectedTarget.onchange = async function () {
        Blockly.Events.recordUndo = false;
        await vm.setEditingTarget(this.value);
        Blockly.Events.recordUndo = true;
    };
}

window.onload = function () {
    const projectIdDom = document.getElementById("projectId");
    let projectId = projectIdDom.innerText = location.hash.substring(1, location.hash.length);
    configureProjectResourceUrl({ LOCAL_ASSET: true });

    const vm = new window.VirtualMachine();
    const requiredAnalysisUi = true;
    if (requiredAnalysisUi) {
        setupAnalysisUI({ vm });
    }

    loadProjectAndRunTask({
        providedVM: vm,
        projectId,
        wsReadyCallback: createAnalysisTask(vm, projectId, function () { updateStatus(projectId, 'DUPEXPR', 'COMPLETE') })
    });
}

