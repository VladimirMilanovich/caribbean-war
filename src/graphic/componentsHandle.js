angular.module('render').factory('Components', function ($rootScope, KeyEvents, userStorage) {

	var BaseComponents = {
		//Envirement
		createOcean: function (scene) {

			//Light
			var light = new BABYLON.DirectionalLight('light', new BABYLON.Vector3(-10, -20, -10), scene);

			light.position = new BABYLON.Vector3(20, 40, 20);
			light.diffuse = new BABYLON.Color3(1, 1, 1);
			light.specular = new BABYLON.Color3(1, 1, 1);
			light.intensity = 1;

			var lensFlareSystem = new BABYLON.LensFlareSystem("lensFlareSystem", light, scene);
			var flare0 = new BABYLON.LensFlare(0.2, 0, new BABYLON.Color3(1, 1, 1), "images/Flare_01.jpg", lensFlareSystem);

			var shadowGenerator = new BABYLON.ShadowGenerator(1024, light);

			// Skybox
			var skybox = BABYLON.Mesh.CreateBox('skyBox', 800, scene);
			var skyboxMaterial = new BABYLON.StandardMaterial('skyBox', scene);

			skyboxMaterial.backFaceCulling = false;
			skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture('images/TropicalSunnyDay', scene);
			skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
			skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
			skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);

			skybox.material = skyboxMaterial;

			var landscape = BABYLON.Mesh.CreateGroundFromHeightMap("landscape", "images/landscape.jpg", 200, 200, 250, 0, 20, scene, false);
			landscape.position.y = -11;
			landscape.position.x = 200;

			//Water
			var extraGround = BABYLON.Mesh.CreateGround('extraGround', 1024, 1024, 2, scene, false);
			var extraGroundMaterial = new BABYLON.StandardMaterial('extraGround', scene);

			extraGroundMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.3, 0.5);
			extraGroundMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
			extraGround.material = extraGroundMaterial;
			extraGround.position.y = -10;

			var waterMaterial = new WORLDMONGER.WaterMaterial('water', scene, light);
			waterMaterial.refractionTexture.renderList.push(extraGround);
			waterMaterial.reflectionTexture.renderList.push(skybox);
			waterMaterial.reflectionTexture.renderList.push(landscape);

			var planeSize = 1000;
			var initiated = false;
			var waterPlanes = [];
			for (var i = 0; i < 4; i++) {
				waterPlanes[i] = BABYLON.Mesh.CreateGround('water_plane_' + i, planeSize, planeSize, 1, scene, false);
				waterPlanes[i].isPickable = false;
				waterPlanes[i].receiveShadows = true;
				waterPlanes[i].material = waterMaterial;
				waterPlanes[i].position.x = i * planeSize;
			}

			return {
				alive: function (origin) {
					if (!origin) return;
					skybox.position.x = lerp(skybox.position.x, origin.x, 0.2);
					skybox.position.z = lerp(skybox.position.z, origin.z, 0.2);

					extraGround.position.x = lerp(extraGround.position.x, origin.x, 0.2);
					extraGround.position.z = lerp(extraGround.position.z, origin.z, 0.2);

					if (initiated) {
						var center = coordinateOrigin(origin, planeSize);
						for (var i in waterPlanes) {
							var deltaX = origin.x - waterPlanes[i].position.x;
							var deltaZ = origin.z - waterPlanes[i].position.z;

							if (Math.abs(deltaX) > planeSize) {
								waterPlanes[i].position.x = center.x + planeSize * Math.sign(deltaX);
							}
							if (Math.abs(deltaZ) > planeSize) {
								waterPlanes[i].position.z = center.z + planeSize * Math.sign(deltaZ);
							}
						}
					}
				},
				setOrigin: function (origin) {
					var center = coordinateOrigin(origin, planeSize);

					var verticalAlign = Math.sign(origin.x - center.x) || 1;
					var horizontalAlign = Math.sign(origin.z - center.z) || 1;

					waterPlanes[0].position = center;
					waterPlanes[1].position = center.add(new BABYLON.Vector3(planeSize * verticalAlign, 0, 0));
					waterPlanes[2].position = center.add(new BABYLON.Vector3(planeSize * verticalAlign, 0, planeSize * horizontalAlign));
					waterPlanes[3].position = center.add(new BABYLON.Vector3(0, 0, planeSize * horizontalAlign));

					initiated = true;
				},
				addObject: function (object) {
					waterMaterial.reflectionTexture.renderList.push(object);
					shadowGenerator.getShadowMap().renderList.push(object);
				}
			};
		},
		//Ship
		createShip: function (scene, details) {
			var ship = null;
			var shipMesh = null;
			var healthBar = null;
			var initiated = false;

			BABYLON.SceneLoader.ImportMesh('ship', 'graphic/models/', 'ship01.babylon', scene, function (meshes) {
				shipMesh = meshes[0];

				if (details.location) {
					shipMesh.position = details.location;
				}
				shipMesh.rotation.y = details.alpha || 0;
				shipMesh.receiveShadows = true;

				var shipMaterial = new BABYLON.StandardMaterial('shipMaterial', scene);

				shipMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
				shipMaterial.diffuseColor = new BABYLON.Color3(0.18, 0.30, 0.30);
				shipMaterial.alpha = 0.71;

				shipMesh.material = shipMaterial;

				ship = angular.extend(shipMesh, {
					currentSpeed: 0,
					speed: 12,
					weight: 1000,
					baseHealth: 1,
					currentHealth: 1
				});
				if (details.hasOwnProperty('baseHealth') && details.hasOwnProperty('currentHealth')) {
					ship.baseHealth = details.baseHealth;
					ship.currentHealth = details.currentHealth;
					healthBar = BaseComponents.createHealthBar(scene, {
						id: details.id,
						baseHealth: details.baseHealth,
						currentHealth: details.currentHealth
					});
				}
				if (details.ocean) details.ocean.addObject(shipMesh);
				initiated = true;
			});

			var shipId = details.id;

			var alive = true;

			var sailsMode = 0;
			var wheelMode = 0;

			//Consts
			var _angleSpeed = 0.075;
			var _velocity = 0.01;

			var obs = 0,
				timer = 0,
				correctionTimer = 0;

			return {
				changeState: function (type) {
					if (!alive) return;
					switch (type) {
					case 'upward':
						sailsMode = Math.min(sailsMode + 1, 3);
						break;
					case 'backward':
						sailsMode = Math.max(sailsMode - 1, 0);
						break;
					case 'right':
						wheelMode = 1;
						break;
					case 'left':
						wheelMode = -1;
						break;
					case 'none':
						wheelMode = 0;
						break;
					default:
						wheelMode = 0;
						break;
					}
				},
				isAlive: function () {
					return alive;
				},
				getId: function () {
					return shipId;
				},
				correctPosition: function (next) {
					if (!ship) return;

					if (correctionTimer > 0.05) {
						ship.position.x = lerp(ship.position.x, next.x, 0.2);
						ship.position.z = lerp(ship.position.z, next.z, 0.2);
						ship.rotation.y = lerp(ship.rotation.y, next.alpha, 0.2);
						correctionTimer = 0;
					} else {
						correctionTimer += (1 / 60);
					}
				},
				getPosition: function () {
					return {
						x: ship ? ship.position.x : 0,
						y: 0,
						z: ship ? ship.position.z : 0,
						alpha: ship ? ship.rotation.y : 0
					};
				},
				getMesh: function () {
					return shipMesh;
				},
				move: function (delay, cameraAlpha) {
					if (!alive) {
						ship.currentSpeed = 0;
						return;
					}
					if (ship) {
						timer += delay % (2 * Math.PI);
						obs = lerp(obs, randomRange(-0.7, 0.7), 0.001);

						ship.currentSpeed = lerp(ship.currentSpeed, sailsMode * ship.speed * delay / 4, _velocity);

						//Movement
						ship.position.x += Math.cos(ship.rotation.y) * ship.currentSpeed;
						ship.position.z += Math.sin(-ship.rotation.y) * ship.currentSpeed;
						ship.position.y += Math.sin(timer * 1.2) * 0.0007;

						//Rotation
						ship.rotation.y = (ship.rotation.y + (wheelMode * ship.currentSpeed * _angleSpeed) / (sailsMode + 1)) % (2 * Math.PI);
						ship.rotation.x = lerp(ship.rotation.x, wheelMode * ship.currentSpeed + obs, 0.02);
						ship.rotation.z = ship.currentSpeed * 0.4 + Math.sin(timer * 1.2) * 0.02;

						if (cameraAlpha && healthBar) {
							healthBar.update({
								alpha: cameraAlpha,
								x: ship.position.x,
								y: 7,
								z: ship.position.z
							});
						}
					}
				},
				isReady: function () {
					return initiated;
				},
				takeDamage: function (param) {
					if (param && param.damage) {
						ship.currentHealth = Math.max(ship.currentHealth - param.damage, 0);
						if (healthBar) healthBar.updateValue(param.damage);
					}
					return 0;
				},
				sink: function () {
					alive = false;
					var timer = 4;
					var intervalId = setInterval(function () {
						ship.position.y -= 0.01;
						if (ship.position.y < -4) {
							clearInterval(intervalId);
						}
					}, 10);
				},
				respawn: function (details) {
					if (alive) return;
					ship.currentHealth = ship.baseHealth;
					healthBar.reset(details);
					ship.position.x = details.position.x;
					ship.position.y = 0;
					ship.position.z = details.position.z;
					ship.rotation.y = details.rotation;
					alive = true;
				},
				remove: function () {
					healthBar.dispose();
					shipMesh.dispose();
				}
			};
		},
		//Water spalsh
		createSplash: function (scene, details) {
			if (!details) return;
			var splashId = details.id + '_' + randomRange(0, 1000);
			var emitter = new BABYLON.Mesh.CreateBox('splash_emitter_' + splashId, 0.01, scene);
			emitter.position = details.location;

			var particleSystem = new BABYLON.ParticleSystem("splash_system_" + randomRange(0, 1000), 2000, scene, null);

			particleSystem.particleTexture = new BABYLON.Texture("./images/light.png", scene);
			particleSystem.emitter = emitter;
			particleSystem.emitRate = 400;
			particleSystem.color1 = new BABYLON.Color4(0.7, 0.8, 1.0, 1.0);
			particleSystem.color2 = new BABYLON.Color4(0.2, 0.5, 1.0, 1.0);
			particleSystem.colorDead = new BABYLON.Color4(0, 0, 0.2, 0.0);
			particleSystem.minSize = 0.1;
			particleSystem.maxSize = 0.5;
			particleSystem.gravity = new BABYLON.Vector3(0, 9.81, 0);
			particleSystem.direction1 = new BABYLON.Vector3(-7, 8, 3);
			particleSystem.direction2 = new BABYLON.Vector3(7, 8, -3);
			particleSystem.start();

			var intervalId = setInterval(function () {
				particleSystem.stop();
				particleSystem.dispose();
				emitter.dispose();
				clearInterval(intervalId);
			}, 300);
		},
		//Health Bar
		createHealthBar: function (scene, details) {
			if (!details) return;

			var baseHealth = details.baseHealth;
			var currentHealth = details.currentHealth;

			var size = 0.3;
			var baseLength = 15;
			var delta = baseLength * size / 2;

			var healthBarScale = new BABYLON.Vector3(0.6, 0.6, 15);

			var healthBar = BABYLON.Mesh.CreateBox('bar_' + details.id, size, scene);
			var healthBarEntry = BABYLON.Mesh.CreateBox('bar_entry_' + details.id, size, scene);

			var healthBarMaterial = new BABYLON.StandardMaterial('healthBarMaterial', scene);
			healthBarMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
			healthBarMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
			healthBarMaterial.emissiveColor = new BABYLON.Color3(0, 0, 0);
			healthBarMaterial.alpha = 0.3;

			var healthBarEntryMaterial = new BABYLON.StandardMaterial('healthBarEntryMaterial', scene);
			healthBarEntryMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.6, 0.8);
			healthBarEntryMaterial.specularColor = new BABYLON.Color3(0.3, 0.6, 0.8);
			healthBarEntryMaterial.emissiveColor = new BABYLON.Color3(0.3, 0.6, 0.8);

			healthBar.scaling = new BABYLON.Vector3(0.6, 0.6, baseLength);
			healthBar.material = healthBarMaterial;

			healthBarEntry.scaling = new BABYLON.Vector3(0.65, 0.65, (currentHealth / baseHealth) * baseLength + 0.5);
			healthBarEntry.material = healthBarEntryMaterial;

			return {
				update: function (location) {
					healthBar.rotation.y = -location.alpha;
					healthBar.position = new BABYLON.Vector3(location.x, location.y, location.z);
					healthBarEntry.rotation.y = -location.alpha;
					healthBarEntry.position = new BABYLON.Vector3(
						location.x + (delta - delta * (currentHealth / baseHealth)) * Math.sin(-location.alpha),
						location.y,
						location.z + (delta - delta * (currentHealth / baseHealth)) * Math.cos(-location.alpha)
					);
				},
				reset: function (location) {
					currentHealth = baseHealth;
				},
				updateValue: function (damage) {
					damage = damage || 0;
					if (currentHealth - damage > 0) {
						currentHealth -= damage;
					} else {
						currentHealth = 0;
						healthBarEntry.isVisible = false;
					}
					healthBarEntry.scaling = new BABYLON.Vector3(0.65, 0.65, (currentHealth / baseHealth) * baseLength + 0.5);
				},
				dispose: function () {
					healthBar.dispose();
					healthBarEntry.dispose();
				}
			}
		},
		//Cannon Ball
		cannonBall: function (scene, details) {
			var ball = new BABYLON.Mesh.CreateSphere('cannon_ball_' + details.id + Math.random().toFixed(3) * 100, 8.0, 0.2, scene);
			ball.position = new BABYLON.Vector3(details.location.x, details.location.y, details.location.z);

			var ballMaterial = new BABYLON.StandardMaterial('shipMaterial', scene);
			ballMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
			ballMaterial.specularColor = new BABYLON.Color3(0, 0, 1);

			ball.material = ballMaterial;

			var t = 0;
			var alpha = -details.alpha - details.direction * Math.PI / 2;
			var intervalId = setInterval(function () {
				t += (scene.getEngine().getDeltaTime() * 0.001);
				if (ball.position.y < 0) {
					BaseComponents.createSplash(scene, {
						id: details.id,
						location: ball.position
					});
					ball.dispose();
					clearInterval(intervalId);
				} else {
					ball.position.x = details.location.x + 100 * t * Math.cos(details.angle) * Math.cos(alpha);
					ball.position.z = details.location.z + 100 * t * Math.cos(details.angle) * Math.sin(alpha);
					ball.position.y = details.location.y + 100 * t * Math.sin(details.angle) - (9.8 * t * t) / 2;
				}
			}, 10);

			return ball;
		},
		//Box
		axis: function (scene) {
			var _axis = [];
			var count = 40,
				ratio = 0.2,
				distance = 10;
			var materials = [
				new BABYLON.StandardMaterial('xMaterial', scene),
				new BABYLON.StandardMaterial('yMaterial', scene),
				new BABYLON.StandardMaterial('zMaterial', scene)
			];
			materials[0].diffuseColor = new BABYLON.Color3(1, 0, 0);
			materials[1].diffuseColor = new BABYLON.Color3(0, 1, 0);
			materials[2].diffuseColor = new BABYLON.Color3(0, 0, 1);

			for (var d = 0; d < 3; d++) {
				var temp = [];
				for (var i = 0; i < count; i++) {
					var obj = BABYLON.Mesh.CreateBox('ax_' + d + '_' + i, 2, scene);
					obj.material = materials[d];
					if (d === 0) obj.position.x = distance * i;
					if (d === 1) obj.position.y = distance * i;
					if (d === 2) obj.position.z = distance * i;
					temp.push(obj);
				}
				_axis.push(temp);
			}

			return {
				target: {
					position: new BABYLON.Vector3(0, 0, 0),
					rotation: new BABYLON.Vector3(0, 0, 0)
				},
				move: function () {
					for (var d = 0; d < 3; d++) {
						for (var i = 0; i < count; i++) {
							if (d === 0) _axis[d][i].position.x = (_axis[d][i].position.x < count * distance) ? _axis[d][i].position.x + ratio : 0;
							if (d === 1) _axis[d][i].position.y = (_axis[d][i].position.y < count * distance) ? _axis[d][i].position.y + ratio : 0;
							if (d === 2) _axis[d][i].position.z = (_axis[d][i].position.z < count * distance) ? _axis[d][i].position.z + ratio : 0;
						}
					}
				}
			};
		},
		//Targeting Curve(s)
		getCurves: function (scene) {
			var reffer = scene;
			var lines = scene.getMeshByName('lines') || new BABYLON.Mesh.CreateLines('lines', [], scene);
			var ratio = 0;
			var collection = [];

			return {
				update: function (point, direction) {
					if (lines) lines.dispose();
					if (direction !== TargetingDirections.none) {
						ratio = 3 - (reffer.pointerY / window.innerHeight) * 6;
						collection = calculateCurve(point, {
							alpha: point.alpha,
							angle: ratio * Math.PI / 24,
							scatter: Math.PI / 22,
							direction: direction
						});
						if (collection.length) {
							lines = new BABYLON.Mesh.CreateLines('lines', collection, reffer);
						}
					} else {
						collection = [];
					}
				},
				angle: function () {
					return correctAngle(ratio * Math.PI / 24);
				}
			};
		}
	};

	return {
		'login': function (scene, camera) {
			var ocean = BaseComponents.createOcean(scene);
			var ship = BaseComponents.createShip(scene, {
				ocean: ocean
			});
			var cameraControl = new CameraController(camera, {});

			return {
				onUpdate: function (delay) {
					cameraControl.observeCorrection();
					cameraControl.baseCorrection();
					ship.move(delay);
				},
				unsubscribe: function () {
					cameraControl.removeEvents();
				}
			};
		},
		'harbor': function (scene, camera) {
			var ocean = BaseComponents.createOcean(scene);
			var ship = BaseComponents.createShip(scene, {
				ocean: ocean
			});
			var cameraControl = new CameraController(camera, {});

			return {
				onUpdate: function (delay) {
					cameraControl.observeCorrection();
				},
				unsubscribe: function () {
					cameraControl.removeEvents();
				}
			};
		},
		'world': function (scene, camera) {

			var ocean = BaseComponents.createOcean(scene);

			var user = userStorage.get();
			var ships = [];
			var shipPosition = new BABYLON.Vector3(user.location.x, 0, user.location.z);
			var ship = BaseComponents.createShip(scene, {
				id: user.id,
				location: shipPosition,
				alpha: user.alpha,
				ocean: ocean,
				baseHealth: userStorage.getShip().baseHP,
				currentHealth: userStorage.getShip().currentHP
			});

			ships.push(ship);
			ocean.setOrigin(shipPosition);

			var curves = BaseComponents.getCurves(scene);

			var targetDirection = TargetingDirections.none;

			//var axis = BaseComponents.axis(scene);

			var cameraControl = new CameraController(camera, {
				target: ship.getPosition()
			});

			var neighbors = userStorage.getNeighbors();
			for (var n in neighbors) {
				if (!neighbors[n].ship) break;
				var position = new BABYLON.Vector3(neighbors[n].location.x, 0, neighbors[n].location.z);
				var newShip = BaseComponents.createShip(scene, {
					id: neighbors[n].id,
					location: position,
					alpha: neighbors[n].alpha,
					baseHealth: neighbors[n].ship.baseHP,
					currentHealth: neighbors[n].ship.currentHP
				});
				ships.push(newShip);
			}

			$('#renderCanvas').on('directionKey', function (event, data) {
				targetDirection = !!data ? data : TargetingDirections.none;
			});

			$('#renderCanvas').on('shootKey', function (event) {
				var optionsServer = {
					location: {
						x: ship.getPosition().x,
						y: 0.001,
						z: ship.getPosition().z
					},
					angle: curves.angle(),
					direction: targetDirection
				};

				if (targetDirection == TargetingDirections.both) {
					optionsServer.direction = TargetingDirections.left;
					$rootScope.$emit('send', {
						action: 'shoot',
						details: optionsServer
					});

					optionsServer.direction = TargetingDirections.right;
					$rootScope.$emit('send', {
						action: 'shoot',
						details: optionsServer
					});
				} else {
					$rootScope.$emit('send', {
						action: 'shoot',
						details: optionsServer
					});
				}
			});

			var onNeigboursCallback = $rootScope.$on('neighbours', function (event, details) {
				var users = details;
				if (users) {
					if (users.added) {
						for (var i in users.added) {
							for (var j in ships) {
								if (ships[j].getId() == users.added[i].id) {
									return;
								}
							}
							if (users.added[i].id != user.id) {
								var position = new BABYLON.Vector3(users.added[i].location.x, 0, users.added[i].location.z);
								var newShip = BaseComponents.createShip(scene, {
									id: users.added[i].id,
									location: position,
									alpha: users.added[i].alpha,
									baseHealth: users.added[i].ship.baseHP,
									currentHealth: users.added[i].ship.currentHP
								});
								ships.push(newShip);
							}
						}
					}
					if (users.removed) {
						for (var k in users.removed) {
							for (var s in ships) {
								if (ships[s].getId() == users.removed[k].id) {
									ships[s].remove();
									ships.splice(s, 1);
								}
							}
						}
					}
				}
			});

			var onPositionCallback = $rootScope.$on('position', function (event, details) {
				for (var s in ships) {
					if (ships[s].getId() == details.id) {
						ships[s].correctPosition({
							x: details.x,
							z: details.z,
							alpha: details.alpha
						});
					}
				}
			});

			var onShootCallback = $rootScope.$on('shoot', function (event, details) {
				for (var i in ships) {
					if (ships[i].getId() == details.id) {
						BaseComponents.cannonBall(scene, details);
						return;
					}
				}
			});

			var onMoveCallback = $rootScope.$on('move', function (event, details) {
				for (var i in ships) {
					if (ships[i].getId() == details.id) {
						if (ship.getId() != details.id) {
							ships[i].correctPosition({
								x: details.location.x,
								z: details.location.z,
								alpha: details.alpha
							});
						}
						ships[i].changeState(details.type);
						return;
					}
				}
			});

			var onHitCallback = $rootScope.$on('hit', function (event, details) {
				for (var i in ships) {
					if (ships[i].getId() == details.id) {
						ships[i].takeDamage(details);
						return;
					}
				}
			});

			var onMissCallback = $rootScope.$on('miss', function (event, details) {
				BaseComponents.createSplash(scene, {
					id: details.id,
					location: details.position
				});
			});

			var onDeathCallback = $rootScope.$on('death', function (event, details) {
				for (var i in ships) {
					if (ships[i].getId() == details.id) {
						ships[i].sink(details);
						return;
					}
				}
			});

			var onRespawnCallback = $rootScope.$on('respawn', function (event, details) {
				for (var i in ships) {
					if (ships[i].getId() == details.id) {
						ships[i].respawn(details);
						return;
					}
				}
			});

			function findShip(id) {
				for (var i in ships) {
					if (ships[i].getId() == id) {
						return ships[i];
					}
				}
				return false;
			}

			return {
				onUpdate: function (delay) {
					cameraControl.baseCorrection();
					cameraControl.trackingCorrection(ship.getPosition());
					cameraControl.targetingCorrection();

					curves.update(ship.getPosition(), targetDirection);

					//axis.move();

					if (ship.isReady()) ocean.alive(ship.getPosition());

					for (var item in ships) {
						ships[item].move(delay, cameraControl.getRotation().alpha);
					}
				},
				unsubscribe: function () {
					onNeigboursCallback();
					onMoveCallback();
					onShootCallback();
					onHitCallback();
					onMissCallback();
					onDeathCallback();
					cameraControl.removeEvents();
				}
			};
		}
	};
});
