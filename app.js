// AI Drone Navigation System
class DroneNavigationSystem {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.drone = null;
        this.obstacles = [];
        this.waypoints = [];
        this.pathPoints = [];
        this.currentWaypointIndex = 0;
        this.isAIMode = false;
        this.isFlying = false;
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        this.cameraMode = 'overhead'; // 'first', 'third', 'overhead'
        this.gridSize = 100;
        this.cellSize = 2;
        this.groundPlane = null;
        this.startTime = Date.now();
        
        // Drone specifications from data
        this.droneSpecs = {
            maxSpeed: 15,
            acceleration: 2,
            rotationSpeed: 0.05,
            batteryCapacity: 100,
            sensorRange: 50,
            safetyRadius: 5,
            currentBattery: 100,
            currentSpeed: 0,
            altitude: 10.5
        };

        // AI state
        this.aiState = {
            pathfinding: 'IDLE',
            obstacleDetection: 'CLEAR',
            navigation: 'READY',
            currentPath: [],
            targetWaypoint: null,
            threatLevel: 0
        };

        // Performance metrics
        this.metrics = {
            fps: 0,
            frameCount: 0,
            lastTime: 0,
            cpuUsage: 45,
            decisionRate: 30,
            pathLength: 0
        };

        this.init();
    }

    init() {
        this.setupScene();
        this.setupLights();
        this.createTerrain();
        this.createDrone();
        this.setupControls();
        this.setupUI();
        this.animate();
        
        // Hide loading screen after initialization
        setTimeout(() => {
            document.getElementById('loadingScreen').classList.add('hidden');
        }, 2000);
    }

    setupScene() {
        const canvas = document.getElementById('droneCanvas');
        const rect = canvas.getBoundingClientRect();
        
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);
        this.scene.fog = new THREE.Fog(0x0a0a0a, 50, 200);

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(
            75, 
            rect.width / rect.height, 
            0.1, 
            1000
        );
        this.setCameraMode('overhead');

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas, 
            antialias: true,
            alpha: true 
        });
        this.renderer.setSize(rect.width, rect.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Handle resize
        window.addEventListener('resize', () => {
            const newRect = canvas.getBoundingClientRect();
            this.camera.aspect = newRect.width / newRect.height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(newRect.width, newRect.height);
        });
    }

    setupLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
        this.scene.add(ambientLight);

        // Directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 200;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        this.scene.add(directionalLight);

        // Point lights for atmosphere
        const pointLight1 = new THREE.PointLight(0x00ffff, 0.5, 100);
        pointLight1.position.set(25, 20, 25);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xff3366, 0.3, 80);
        pointLight2.position.set(-25, 15, -25);
        this.scene.add(pointLight2);
    }

    createTerrain() {
        // Grid ground
        const gridHelper = new THREE.GridHelper(this.gridSize, this.gridSize / this.cellSize, 0x00ffff, 0x333333);
        gridHelper.material.opacity = 0.3;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);

        // Ground plane for raycasting
        const groundGeometry = new THREE.PlaneGeometry(this.gridSize, this.gridSize);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x111111,
            transparent: true,
            opacity: 0.8
        });
        this.groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
        this.groundPlane.rotation.x = -Math.PI / 2;
        this.groundPlane.receiveShadow = true;
        this.groundPlane.userData = { isGround: true };
        this.scene.add(this.groundPlane);

        // Add some default obstacles
        this.addObstacle(10, 5, 10);
        this.addObstacle(-15, 8, -5);
        this.addObstacle(20, 6, -20);
        this.addObstacle(-10, 4, 15);
    }

    createDrone() {
        // Drone group
        this.drone = new THREE.Group();
        
        // Main body
        const bodyGeometry = new THREE.BoxGeometry(2, 0.5, 1);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        this.drone.add(body);

        // Propellers
        const propellerGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.1, 8);
        const propellerMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x00ffff,
            transparent: true,
            opacity: 0.7 
        });

        const positions = [
            { x: 1.5, y: 0.5, z: 1.5 },
            { x: -1.5, y: 0.5, z: 1.5 },
            { x: 1.5, y: 0.5, z: -1.5 },
            { x: -1.5, y: 0.5, z: -1.5 }
        ];

        this.propellers = [];
        positions.forEach(pos => {
            const propeller = new THREE.Mesh(propellerGeometry, propellerMaterial);
            propeller.position.set(pos.x, pos.y, pos.z);
            propeller.castShadow = true;
            this.propellers.push(propeller);
            this.drone.add(propeller);
        });

        // LED lights
        const ledGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const frontLED = new THREE.Mesh(ledGeometry, new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
        frontLED.position.set(0, 0, 1.2);
        this.drone.add(frontLED);

        const backLED = new THREE.Mesh(ledGeometry, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        backLED.position.set(0, 0, -1.2);
        this.drone.add(backLED);

        // Position drone
        this.drone.position.set(0, this.droneSpecs.altitude, 0);
        this.scene.add(this.drone);

        // Sensor range visualization
        const sensorGeometry = new THREE.SphereGeometry(this.droneSpecs.sensorRange, 16, 16);
        const sensorMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
            transparent: true, 
            opacity: 0.1,
            wireframe: true 
        });
        this.sensorRange = new THREE.Mesh(sensorGeometry, sensorMaterial);
        this.sensorRange.visible = false;
        this.drone.add(this.sensorRange);
    }

    addObstacle(x, height, z) {
        const geometry = new THREE.BoxGeometry(4, height, 4);
        const material = new THREE.MeshPhongMaterial({ color: 0xff3366 }); // Red color
        const obstacle = new THREE.Mesh(geometry, material);
        obstacle.position.set(x, height / 2, z);
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;
        obstacle.userData = { isObstacle: true };
        this.obstacles.push(obstacle);
        this.scene.add(obstacle);
        
        // Add warning light
        const lightGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const warningLight = new THREE.Mesh(lightGeometry, lightMaterial);
        warningLight.position.set(0, height + 0.5, 0);
        obstacle.add(warningLight);
    }

    addWaypoint(x, z) {
        const geometry = new THREE.ConeGeometry(1, 3, 8);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0x00ff00, // Green color
            transparent: true,
            opacity: 0.8 
        });
        const waypoint = new THREE.Mesh(geometry, material);
        waypoint.position.set(x, 1.5, z);
        waypoint.userData = { type: 'waypoint' };
        
        // Add pulsing animation
        waypoint.userData.originalScale = waypoint.scale.clone();
        
        this.waypoints.push(waypoint);
        this.scene.add(waypoint);
        
        if (this.isAIMode) {
            this.planPath();
        }
        
        console.log('Waypoint added at:', x, z);
    }

    setupControls() {
        const canvas = document.getElementById('droneCanvas');
        
        // Keyboard controls
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
            
            switch(event.code) {
                case 'KeyM':
                    this.toggleMode();
                    break;
                case 'KeyE':
                    this.emergencyLand();
                    break;
            }
            event.preventDefault();
        });

        document.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
            event.preventDefault();
        });

        // Mouse controls
        canvas.addEventListener('click', (event) => {
            const rect = canvas.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                -((event.clientY - rect.top) / rect.height) * 2 + 1
            );

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, this.camera);
            
            // Check intersection with ground plane
            const intersects = raycaster.intersectObject(this.groundPlane);
                
            if (intersects.length > 0) {
                const point = intersects[0].point;
                
                if (event.ctrlKey || event.metaKey) {
                    // Place obstacle
                    this.addObstacle(point.x, 5, point.z);
                    this.updateAIStatus('obstacleDetection', 'DETECTED');
                    console.log('Obstacle placed at:', point.x, point.z);
                } else {
                    // Set waypoint
                    this.addWaypoint(point.x, point.z);
                }
            }
        });

        canvas.addEventListener('mousemove', (event) => {
            const rect = canvas.getBoundingClientRect();
            this.mouse.x = (event.clientX - rect.left) / rect.width * 2 - 1;
            this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        });

        // Prevent context menu on right click
        canvas.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
    }

    setupUI() {
        // Mode toggle - Fixed event listener
        const toggleButton = document.getElementById('toggleMode');
        if (toggleButton) {
            toggleButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleMode();
            });
        }

        // Emergency land
        const emergencyButton = document.getElementById('emergencyLand');
        if (emergencyButton) {
            emergencyButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.emergencyLand();
            });
        }

        // Camera controls
        document.getElementById('cameraFirst').addEventListener('click', () => {
            this.setCameraMode('first');
        });
        document.getElementById('cameraThird').addEventListener('click', () => {
            this.setCameraMode('third');
        });
        document.getElementById('cameraOverhead').addEventListener('click', () => {
            this.setCameraMode('overhead');
        });

        // Parameter controls
        document.getElementById('maxSpeed').addEventListener('input', (e) => {
            this.droneSpecs.maxSpeed = parseInt(e.target.value);
            e.target.nextElementSibling.textContent = e.target.value;
        });

        document.getElementById('safetyRadius').addEventListener('input', (e) => {
            this.droneSpecs.safetyRadius = parseInt(e.target.value);
            e.target.nextElementSibling.textContent = e.target.value;
        });

        document.getElementById('aggressiveness').addEventListener('input', (e) => {
            e.target.nextElementSibling.textContent = e.target.value;
        });

        // Action buttons
        document.getElementById('clearPath').addEventListener('click', () => {
            this.clearWaypoints();
        });

        document.getElementById('clearObstacles').addEventListener('click', () => {
            this.clearObstacles();
        });

        document.getElementById('resetDrone').addEventListener('click', () => {
            this.resetDronePosition();
        });

        document.getElementById('downloadLog').addEventListener('click', () => {
            this.downloadFlightLog();
        });

        // Hide controls info after 5 seconds
        setTimeout(() => {
            document.getElementById('controlsInfo').classList.add('hidden');
        }, 5000);
    }

    toggleMode() {
        this.isAIMode = !this.isAIMode;
        const modeButton = document.getElementById('toggleMode');
        const modeDisplay = document.getElementById('currentMode');
        
        console.log('Toggling mode to:', this.isAIMode ? 'AI' : 'MANUAL');
        
        if (this.isAIMode) {
            modeButton.textContent = 'MANUAL MODE';
            modeButton.className = 'btn btn--outline';
            modeDisplay.textContent = 'AI';
            this.updateAIStatus('navigation', 'ACTIVE');
            this.sensorRange.visible = true;
            if (this.waypoints.length > 0) {
                this.planPath();
            }
        } else {
            modeButton.textContent = 'AI MODE';
            modeButton.className = 'btn btn--primary';
            modeDisplay.textContent = 'MANUAL';
            this.updateAIStatus('navigation', 'READY');
            this.sensorRange.visible = false;
            this.clearPath();
        }
    }

    setCameraMode(mode) {
        this.cameraMode = mode;
        
        // Update button states
        document.querySelectorAll('.camera-controls .btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`camera${mode.charAt(0).toUpperCase() + mode.slice(1)}`).classList.add('active');
        
        switch(mode) {
            case 'first':
                this.camera.position.set(0, 2, 0);
                this.camera.lookAt(0, 2, 10);
                break;
            case 'third':
                this.camera.position.set(0, 15, 20);
                this.camera.lookAt(0, 5, 0);
                break;
            case 'overhead':
                this.camera.position.set(0, 80, 0);
                this.camera.lookAt(0, 0, 0);
                break;
        }
    }

    // A* Pathfinding Algorithm
    planPath() {
        if (this.waypoints.length === 0) return;
        
        this.updateAIStatus('pathfinding', 'COMPUTING');
        
        const start = {
            x: Math.round(this.drone.position.x / this.cellSize),
            z: Math.round(this.drone.position.z / this.cellSize)
        };
        
        const targetWaypoint = this.waypoints[this.currentWaypointIndex] || this.waypoints[this.waypoints.length - 1];
        const goal = {
            x: Math.round(targetWaypoint.position.x / this.cellSize),
            z: Math.round(targetWaypoint.position.z / this.cellSize)
        };

        const path = this.aStar(start, goal);
        this.aiState.currentPath = path.map(p => ({
            x: p.x * this.cellSize,
            z: p.z * this.cellSize,
            y: this.droneSpecs.altitude
        }));
        
        this.visualizePath();
        this.updateAIStatus('pathfinding', 'COMPLETE');
        this.metrics.pathLength = this.calculatePathLength();
        
        console.log('Path planned with', this.aiState.currentPath.length, 'points');
    }

    aStar(start, goal) {
        const openSet = [start];
        const closedSet = [];
        const gScore = {};
        const fScore = {};
        const cameFrom = {};
        
        gScore[`${start.x},${start.z}`] = 0;
        fScore[`${start.x},${start.z}`] = this.heuristic(start, goal);
        
        while (openSet.length > 0) {
            // Find node with lowest fScore
            let current = openSet.reduce((prev, curr) => 
                fScore[`${curr.x},${curr.z}`] < fScore[`${prev.x},${prev.z}`] ? curr : prev
            );
            
            if (current.x === goal.x && current.z === goal.z) {
                // Reconstruct path
                const path = [];
                let temp = current;
                while (temp) {
                    path.unshift(temp);
                    temp = cameFrom[`${temp.x},${temp.z}`];
                }
                return path;
            }
            
            openSet.splice(openSet.indexOf(current), 1);
            closedSet.push(current);
            
            // Check neighbors
            const neighbors = [
                { x: current.x + 1, z: current.z },
                { x: current.x - 1, z: current.z },
                { x: current.x, z: current.z + 1 },
                { x: current.x, z: current.z - 1 },
                { x: current.x + 1, z: current.z + 1 },
                { x: current.x - 1, z: current.z - 1 },
                { x: current.x + 1, z: current.z - 1 },
                { x: current.x - 1, z: current.z + 1 }
            ];
            
            for (let neighbor of neighbors) {
                if (this.isObstacle(neighbor.x * this.cellSize, neighbor.z * this.cellSize)) continue;
                if (closedSet.some(p => p.x === neighbor.x && p.z === neighbor.z)) continue;
                
                const tentativeGScore = gScore[`${current.x},${current.z}`] + 1;
                const neighborKey = `${neighbor.x},${neighbor.z}`;
                
                if (!openSet.some(p => p.x === neighbor.x && p.z === neighbor.z)) {
                    openSet.push(neighbor);
                } else if (tentativeGScore >= (gScore[neighborKey] || Infinity)) {
                    continue;
                }
                
                cameFrom[neighborKey] = current;
                gScore[neighborKey] = tentativeGScore;
                fScore[neighborKey] = tentativeGScore + this.heuristic(neighbor, goal);
            }
        }
        
        return [start, goal]; // Return direct path if no path found
    }

    heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
    }

    isObstacle(x, z) {
        return this.obstacles.some(obstacle => {
            const distance = Math.sqrt(
                Math.pow(obstacle.position.x - x, 2) + 
                Math.pow(obstacle.position.z - z, 2)
            );
            return distance < this.droneSpecs.safetyRadius;
        });
    }

    visualizePath() {
        // Remove existing path visualization
        const existingPath = this.scene.getObjectByName('pathLine');
        if (existingPath) {
            this.scene.remove(existingPath);
        }

        if (this.aiState.currentPath.length < 2) return;

        const points = this.aiState.currentPath.map(p => new THREE.Vector3(p.x, p.y, p.z));
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ 
            color: 0x00ffff, // Blue color as specified
            linewidth: 3,
            transparent: true,
            opacity: 0.8 
        });
        
        const line = new THREE.Line(geometry, material);
        line.name = 'pathLine';
        this.scene.add(line);
        
        console.log('Path visualized with', points.length, 'points');
    }

    updateDrone() {
        if (!this.drone) return;

        if (this.isAIMode) {
            this.updateAINavigation();
        } else {
            this.updateManualControl();
        }

        // Update propeller rotation
        if (this.propellers) {
            this.propellers.forEach(propeller => {
                propeller.rotation.y += 0.5;
            });
        }

        // Update battery (simulate drain)
        if (this.droneSpecs.currentSpeed > 0) {
            this.droneSpecs.currentBattery = Math.max(0, this.droneSpecs.currentBattery - 0.01);
        }

        // Update altitude based on current position
        this.droneSpecs.altitude = this.drone.position.y;

        // Update UI
        this.updateUI();
        
        // Update camera based on mode
        if (this.cameraMode === 'first') {
            this.camera.position.copy(this.drone.position);
            this.camera.position.y += 2;
        } else if (this.cameraMode === 'third') {
            const offset = new THREE.Vector3(0, 15, 20);
            this.camera.position.copy(this.drone.position).add(offset);
            this.camera.lookAt(this.drone.position);
        }
    }

    updateAINavigation() {
        if (this.aiState.currentPath.length === 0) {
            this.droneSpecs.currentSpeed = 0;
            return;
        }

        const currentTarget = this.aiState.currentPath[0];
        if (!currentTarget) return;

        const dronePos = this.drone.position.clone();
        const targetPos = new THREE.Vector3(currentTarget.x, currentTarget.y, currentTarget.z);
        const direction = targetPos.sub(dronePos).normalize();
        
        // Check for obstacles in path
        const obstacleDetected = this.detectObstacles();
        if (obstacleDetected && this.aiState.currentPath.length > 1) {
            this.updateAIStatus('obstacleDetection', 'AVOIDING');
            // Simple avoidance - skip to next path point if available
            this.aiState.currentPath.shift();
        } else {
            this.updateAIStatus('obstacleDetection', 'CLEAR');
        }

        // Move towards target
        const speed = this.droneSpecs.maxSpeed * 0.01;
        this.drone.position.add(direction.multiplyScalar(speed));
        this.droneSpecs.currentSpeed = speed * 100;

        // Check if reached current path point
        const distanceToTarget = dronePos.distanceTo(new THREE.Vector3(currentTarget.x, currentTarget.y, currentTarget.z));
        if (distanceToTarget < 2) {
            this.aiState.currentPath.shift();
            
            // If reached waypoint, move to next
            if (this.aiState.currentPath.length === 0 && this.currentWaypointIndex < this.waypoints.length - 1) {
                this.currentWaypointIndex++;
                setTimeout(() => this.planPath(), 100);
            }
        }
    }

    updateManualControl() {
        const speed = 0.3;
        const rotSpeed = 0.05;
        let moved = false;

        if (this.keys['KeyW']) {
            this.drone.position.z -= speed;
            this.droneSpecs.currentSpeed = speed * 100;
            moved = true;
        }
        if (this.keys['KeyS']) {
            this.drone.position.z += speed;
            this.droneSpecs.currentSpeed = speed * 100;
            moved = true;
        }
        if (this.keys['KeyA']) {
            this.drone.position.x -= speed;
            this.drone.rotation.z = rotSpeed;
            moved = true;
        } else if (this.keys['KeyD']) {
            this.drone.position.x += speed;
            this.drone.rotation.z = -rotSpeed;
            moved = true;
        } else {
            this.drone.rotation.z *= 0.95; // Gradual level out
        }
        
        if (this.keys['Space']) {
            this.drone.position.y += speed * 0.5;
            this.droneSpecs.altitude = this.drone.position.y;
            moved = true;
        }
        if (this.keys['ShiftLeft']) {
            this.drone.position.y = Math.max(1, this.drone.position.y - speed * 0.5);
            this.droneSpecs.altitude = this.drone.position.y;
            moved = true;
        }

        if (!moved) {
            this.droneSpecs.currentSpeed *= 0.95; // Deceleration
        }
    }

    detectObstacles() {
        const dronePos = this.drone.position;
        return this.obstacles.some(obstacle => {
            const distance = dronePos.distanceTo(obstacle.position);
            return distance < this.droneSpecs.sensorRange;
        });
    }

    updateAIStatus(component, status) {
        this.aiState[component] = status;
        const statusElement = document.getElementById(`${component}Status`);
        if (statusElement) {
            statusElement.textContent = status;
            statusElement.className = 'status ' + this.getStatusClass(status);
        }
    }

    getStatusClass(status) {
        switch(status.toLowerCase()) {
            case 'active':
            case 'complete':
            case 'clear':
            case 'ready':
            case 'locked':
            case 'stable':
                return 'status--success';
            case 'computing':
            case 'avoiding':
            case 'detected':
                return 'status--warning';
            case 'error':
            case 'failed':
                return 'status--error';
            default:
                return 'status--info';
        }
    }

    updateUI() {
        // Update HUD
        document.getElementById('altitude').textContent = `${this.droneSpecs.altitude.toFixed(1)}m`;
        document.getElementById('speed').textContent = `${this.droneSpecs.currentSpeed.toFixed(1)} m/s`;
        document.getElementById('battery').textContent = `${Math.round(this.droneSpecs.currentBattery)}%`;

        // Update metrics
        document.getElementById('pathLength').textContent = `${Math.round(this.metrics.pathLength)}m`;
        document.getElementById('fpsCounter').textContent = Math.round(this.metrics.fps);
        document.getElementById('cpuUsage').textContent = `${this.metrics.cpuUsage}%`;
        document.getElementById('decisionRate').textContent = this.metrics.decisionRate;

        // Animate waypoints
        this.waypoints.forEach((waypoint, index) => {
            const time = Date.now() * 0.001;
            const scale = 1 + Math.sin(time * 2 + index) * 0.1;
            waypoint.scale.setScalar(scale);
        });
    }

    calculatePathLength() {
        if (this.aiState.currentPath.length < 2) return 0;
        
        let length = 0;
        for (let i = 1; i < this.aiState.currentPath.length; i++) {
            const p1 = this.aiState.currentPath[i - 1];
            const p2 = this.aiState.currentPath[i];
            length += Math.sqrt(
                Math.pow(p2.x - p1.x, 2) + 
                Math.pow(p2.y - p1.y, 2) + 
                Math.pow(p2.z - p1.z, 2)
            );
        }
        return length;
    }

    clearWaypoints() {
        this.waypoints.forEach(waypoint => this.scene.remove(waypoint));
        this.waypoints = [];
        this.clearPath();
        this.currentWaypointIndex = 0;
    }

    clearObstacles() {
        // Keep some default obstacles, remove user-added ones
        const defaultCount = 4;
        const userObstacles = this.obstacles.slice(defaultCount);
        userObstacles.forEach(obstacle => this.scene.remove(obstacle));
        this.obstacles = this.obstacles.slice(0, defaultCount);
        this.updateAIStatus('obstacleDetection', 'CLEAR');
    }

    clearPath() {
        const pathLine = this.scene.getObjectByName('pathLine');
        if (pathLine) this.scene.remove(pathLine);
        this.aiState.currentPath = [];
    }

    resetDronePosition() {
        this.drone.position.set(0, this.droneSpecs.altitude, 0);
        this.drone.rotation.set(0, 0, 0);
        this.droneSpecs.currentSpeed = 0;
        this.currentWaypointIndex = 0;
        this.clearPath();
    }

    emergencyLand() {
        this.isAIMode = false;
        this.clearPath();
        this.updateAIStatus('navigation', 'LANDING');
        
        // Update UI immediately
        const modeButton = document.getElementById('toggleMode');
        const modeDisplay = document.getElementById('currentMode');
        modeButton.textContent = 'AI MODE';
        modeButton.className = 'btn btn--primary';
        modeDisplay.textContent = 'MANUAL';
        
        // Animate landing
        const landingAnimation = () => {
            if (this.drone.position.y > 1) {
                this.drone.position.y -= 0.1;
                this.droneSpecs.altitude = this.drone.position.y;
                requestAnimationFrame(landingAnimation);
            } else {
                this.droneSpecs.currentSpeed = 0;
                this.updateAIStatus('navigation', 'LANDED');
            }
        };
        landingAnimation();
    }

    downloadFlightLog() {
        const log = {
            timestamp: new Date().toISOString(),
            dronePosition: {
                x: this.drone.position.x,
                y: this.drone.position.y,
                z: this.drone.position.z
            },
            flightTime: Date.now() - this.startTime,
            batteryUsed: 100 - this.droneSpecs.currentBattery,
            waypointsVisited: this.currentWaypointIndex,
            totalDistance: this.metrics.pathLength,
            aiDecisions: this.metrics.decisionRate * (Date.now() - this.startTime) / 1000,
            mode: this.isAIMode ? 'AI' : 'MANUAL'
        };
        
        const dataStr = JSON.stringify(log, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `drone_flight_log_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Calculate FPS
        const now = performance.now();
        this.metrics.frameCount++;
        if (now - this.metrics.lastTime >= 1000) {
            this.metrics.fps = this.metrics.frameCount;
            this.metrics.frameCount = 0;
            this.metrics.lastTime = now;
            
            // Update random metrics for realism
            this.metrics.cpuUsage = 40 + Math.random() * 20;
            this.metrics.decisionRate = 25 + Math.random() * 10;
        }

        this.updateDrone();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new DroneNavigationSystem();
});