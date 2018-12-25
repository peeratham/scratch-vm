var app = angular.module('projectCollectorApp', []);

app.controller('collectProjectTaskController', async function ($scope, $http) {
    $scope.projects = await $http({
        method: "GET",
        url: 'http://localhost:3000/projects/retrieve?start=0&end=1&limit=10'
    }).then(resp => resp.data,
        err => { console.log(err); }
    );
    $scope.$apply();

    $scope.projects.map(project => {
        console.log(JSON.stringify(project));
        let projectInfo = {
            _id: project.id,
            stats_views: project.stats.views,
            stats_remixes: project.stats.remixes,
            history_created: project.history.created,
            histroy_modified: project.history.modified
        };
        $http.get('http://localhost:3000/projects/' + project.id).then(
            function (response) {
                console.log(project.id + ' already exists');
            }, function (response) {
                $http.post('http://localhost:3000/projects', JSON.stringify(projectInfo)).then(
                    function (response) {
                        console.log("successfully saved:" + projectInfo._id);
                    }, function (response) {
                        console.log("failing to save " + projectInfo._id);
                    });
            }
        )


    });

});