var app = angular.module('myApp', []);
app.controller('analysisTaskController', async function ($scope, $http) {
    $scope.projects = {};
    $scope.projectDataStatuses = {};
    $scope.tasks = {
        data: true,
        coverage: false
    };
    $scope.getStatus = function (id) {
        if ($scope.projectDataStatuses[id]) {
            return $scope.projectDataStatuses[id]['project_dir_exists'] === true ? "found" : "missing";
        }
        return "";
    }

    const getMissing = () => projects.filter(p => projectDataStatuses[p._id]['project_dir_exists'] === false).map(p => p._id);

    $scope.updateStatus = function (id) {
        $http({
            method: "GET",
            url: `http://localhost:3000/data/${id}`
        }).then(resp => $scope.projectDataStatuses[id] = resp.data)
        .then(()=>{
            $scope.missingCount = getMissing().length;
        });
    }

    let projects = $scope.projects = await $http({
        method: "GET",
        url: "http://localhost:3000/projects"
    }).then(resp => resp.data);

    let projectDataStatuses = $scope.projectDataStatuses = (await Promise.all(projects.map(p =>
        $http({
            method: "GET",
            url: `http://localhost:3000/data/${p._id}`
        })
    )).then(statuses => statuses.map(st => st.data)))
        .reduce((obj, item) => { obj[item._id] = item; return obj; }, {});

    let incompleteProjectIds = projects.filter(p => projectDataStatuses[p._id]['project_dir_exists'] === false).map(p => p._id);
    $scope.missingCount = getMissing().length;
    $scope.$apply();

    //start!
    window.parent.postMessage({
        type: 'START'
    }, '*');

    const frame = document.getElementsByTagName('iframe')[0];
    window.addEventListener("message", function (message) {
        const { project_id, type } = message.data;
    
        if (type === "NEXT" || type === "START") {
            if (type === "NEXT") {
                $scope.updateStatus(project_id);
                $scope.$apply();
            };
            if (incompleteProjectIds.length > 0) {
                let nextProjectId = incompleteProjectIds.shift();
                frame.contentWindow.location.assign(`executor-download.html#${nextProjectId}`);
            }
        }
    });
});