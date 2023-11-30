class WindowManager {
	#windows;
	#count;
	#id;
	#winData;
	#winShapeChangeCallback;
	#winChangeCallback;

	constructor() {
		let that = this;

		addEventListener("storage", (event) => {
			if (event.key == "windows") {
				let newWindows = JSON.parse(event.newValue);
				let winChange = that.#didWindowsChange(that.#windows, newWindows);
				that.#windows = newWindows;
				if (winChange && that.#winChangeCallback) that.#winChangeCallback();
			}
		});

		window.addEventListener('beforeunload', function(e) {
			let index = that.getWindowIndexFromId(that.#id);
			that.#windows.splice(index, 1);
			that.updateWindowsLocalStorage();
		});
	}

	#didWindowsChange(pWins, nWins) {
		if (pWins.length !== nWins.length) {
			return true;
		} else {
			for (let index = 0; index < pWins.length; index++) {
				if (pWins[index].id !== nWins[index].id) {
					return true;
				}
			}
			return false;
		}
	}

	init(metaData) {
		this.#windows = JSON.parse(localStorage.getItem("windows")) || [];
		this.#count = +localStorage.getItem("count") || 0;
		this.#count++;
		this.#id = this.#count;
		let shape = this.getWinShape();
		this.#winData = {
			id: this.#id,
			shape: shape,
			metaData: metaData
		};
		this.#windows.push(this.#winData);
		localStorage.setItem("count", this.#count);
		this.updateWindowsLocalStorage();
	}

	getWinShape() {
		return {
			x: window.screenX,
			y: window.screenY,
			w: window.innerWidth,
			h: window.innerHeight
		};
	}

	getWindowIndexFromId(id) {
		return this.#windows.findIndex(window => window.id === id);
	}

	updateWindowsLocalStorage() {
		localStorage.setItem("windows", JSON.stringify(this.#windows));
	}

	update() {
		let winShape = this.getWinShape();
		if (JSON.stringify(winShape) !== JSON.stringify(this.#winData.shape)) {
			this.#winData.shape = winShape;
			let index = this.getWindowIndexFromId(this.#id);
			this.#windows[index].shape = winShape;
			if (this.#winShapeChangeCallback) this.#winShapeChangeCallback();
			this.updateWindowsLocalStorage();
		}
	}

	setWinShapeChangeCallback(callback) {
		this.#winShapeChangeCallback = callback;
	}

	setWinChangeCallback(callback) {
		this.#winChangeCallback = callback;
	}

	getWindows() {
		return this.#windows;
	}

	getThisWindowData() {
		return this.#winData;
	}

	getThisWindowID() {
		return this.#id;
	}
}

let camera, scene, renderer, world;
let near, far;
let pixR = window.devicePixelRatio ? window.devicePixelRatio : 1;
let cubes = [];
let sceneOffsetTarget = {
	x: 0,
	y: 0
};
let sceneOffset = {
	x: 0,
	y: 0
};

let today = new Date();
today.setHours(0);
today.setMinutes(0);
today.setSeconds(0);
today.setMilliseconds(0);
today = today.getTime();

let internalTime = getTime();
let windowManager;
let initialized = false;

function getTime() {
	return (new Date().getTime() - today) / 1000.0;
}

if (new URLSearchParams(window.location.search).get("clear")) {
	localStorage.clear();
} else {
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState != 'hidden' && !initialized) {
			init();
		}
	});

	window.onload = () => {
		if (document.visibilityState != 'hidden') {
			init();
		}
	};

	function init() {
		initialized = true;
		setTimeout(() => {
			setupScene();
			setupWindowManager();
			resize();
			updateWindowShape(false);
			render();
			window.addEventListener('resize', resize);
		}, 500);
	}

	function setupScene() {
		camera = new THREE.OrthographicCamera(0, 0, window.innerWidth, window.innerHeight, -10000, 10000);
		camera.position.z = 2.5;
		near = camera.position.z - .5;
		far = camera.position.z + 0.5;

		scene = new THREE.Scene();
		scene.background = new THREE.Color(0.0);
		scene.add(camera);

		renderer = new THREE.WebGLRenderer({
			antialias: true,
			depthBuffer: true
		});
		renderer.setPixelRatio(pixR);
		world = new THREE.Object3D();
		scene.add(world);

		renderer.domElement.setAttribute("id", "scene");
		document.body.appendChild(renderer.domElement);
	}

	function setupWindowManager() {
		windowManager = new WindowManager();
		windowManager.setWinShapeChangeCallback(updateWindowShape);
		windowManager.setWinChangeCallback(windowsUpdated);
		let metaData = {
			foo: "bar"
		};
		windowManager.init(metaData);
		windowsUpdated();
	}

	function windowsUpdated() {
		updateNumberOfCubes();
	}

	function updateNumberOfCubes() {
		let wins = windowManager.getWindows();
		cubes.forEach((color) => {
			world.remove(color);
		})
		cubes = [];
		for (let index = 0; index < wins.length; index++) {
			let window = wins[index];
			let color = new THREE.Color();
			color.setHSL(index * .1, 1.0, .5);
			let size = 100 + index * 50;

			let cube =
			new THREE.Mesh(
			new THREE.BoxGeometry(size, size, size), 
			new THREE.MeshBasicMaterial({
				color: 0x00ff00,
				wireframe: true
			}));

			cube.position.x = window.shape.x + (window.shape.w * .5);
			cube.position.y = window.shape.y + (window.shape.h * .5);
			
			world.add(cube);
			cubes.push(cube);
		}
	}

	function updateWindowShape(easing = true) {
		sceneOffsetTarget = {
			x: -window.screenX,
			y: -window.screenY
		};
		if (!easing) sceneOffset = sceneOffsetTarget;
	}

	function render() {
		let THREE = getTime();
		windowManager.update();
		let falloff = .05;
		sceneOffset.x = sceneOffset.x + ((sceneOffsetTarget.x - sceneOffset.x) * falloff);
		sceneOffset.y = sceneOffset.y + ((sceneOffsetTarget.y - sceneOffset.y) * falloff);
		world.position.x = sceneOffset.x;
		world.position.y = sceneOffset.y;
		let wins = windowManager.getWindows();
		for (let index = 0; index < cubes.length; index++) {
			let cube = cubes[index];
			let window = wins[index];
			let _THREE = THREE;
			let posTarget = {
				x: window.shape.x + (window.shape.w * .5),
				y: window.shape.y + (window.shape.h * .5)
			};
			cube.position.x = cube.position.x + (posTarget.x - cube.position.x) * falloff;
			cube.position.y = cube.position.y + (posTarget.y - cube.position.y) * falloff;
			cube.rotation.x = _THREE * .5;
			cube.rotation.y = _THREE * .3;
		};
		renderer.render(scene, camera);
		requestAnimationFrame(render);
	}

	function resize() {
		let width = window.innerWidth;
		let height = window.innerHeight
		camera = new THREE.OrthographicCamera(0, width, 0, height, -10000, 10000);
		camera.updateProjectionMatrix();
		renderer.setSize(width, height);
	}
}
