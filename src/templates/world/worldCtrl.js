caribbeanWarApp.controller('worldCtrl', ['$scope', '$state', '$rootScope', 'connection', 'userStorage',
	function ($scope, $state, $rootScope, connection, userStorage) {

		if (!userStorage.status()) {
			$rootScope.$emit('close', false);
		}

		$scope.user = userStorage.get();

		$scope.isDeathCloakVisiable = false;
		$scope.isRespawnAvaible = false;

		$scope.sailsMode = 0;
		$scope.wheelMode = 0;
		$scope.baseHealth = userStorage.getShip().baseHP || 0;
		$scope.currentHealth = userStorage.getShip().currentHP || 0;

		$scope.position = {};

		$rootScope.callbacks.push($rootScope.$on('hit', function (event, details) {
			if ($scope.user.id == details.id) {
				$scope.currentHealth -= details.damage || 0;
			}
		}));

		$rootScope.callbacks.push($rootScope.$on('respawn', function (event, details) {
			//if ($scope.user.id == details.id) {
				$scope.currentHealth = $scope.baseHealth;
				$scope.isDeathCloakVisiable = false;
			//}
		}));

		$rootScope.callbacks.push($rootScope.$on('miss', function (event, details) {
			//miss actions
		}));

		$rootScope.callbacks.push($rootScope.$on('movementKey', function (event, command) {
			if (connection.status() && $scope.user.id) {
				connection.send('move', {
					type: command
				});
			}
		}));

		$rootScope.callbacks.push($rootScope.$on('death', function (event, details) {
			if (details.id && $scope.user.id == details.id) {
				$scope.isDeathCloakVisiable = true;
				var intervalId = setTimeout(function () {
					$scope.isRespawnAvaible = true;
					clearInterval(intervalId);
				}, 3000);
			}
		}));

		$rootScope.callbacks.push($rootScope.$on('move', function (event, command) {
			if ($scope.user.id != command.id) return;
			switch (command.type) {
			case 'upward':
				$scope.sailsMode = Math.min($scope.sailsMode + 1, 3);
				break;
			case 'backward':
				$scope.sailsMode = Math.max($scope.sailsMode - 1, 0);
				break;
			case 'right':
				$scope.wheelMode = 1;
				break;
			case 'left':
				$scope.wheelMode = -1;
				break;
			case 'none':
				$scope.wheelMode = 0;
				break;
			default:
				break;
			}
		}));

		$rootScope.callbacks.push($rootScope.$on('position', function (event, details) {
			update(function () {
				if (details.id && $scope.user.id == details.id) {
					$scope.position = details;
				}
			});
		}));

		$scope.respawn = function () {
			$rootScope.$emit('send', {
				action: 'respawn',
				details: {}
			});
		};

		function update(fn) {
			var phase = $rootScope.$$phase;

			if (phase == '$apply' || phase == '$digest') {
				if (fn && (typeof (fn) === 'function')) {
					fn();
				}
			} else {
				$scope.$apply(fn);
			}
		}
	}
]);
