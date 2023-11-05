import {AfterViewInit, Component, ElementRef, HostListener, OnInit, ViewChild} from '@angular/core';
import * as THREE from 'three';
import * as Controls from 'three/examples/jsm/controls/OrbitControls';
import {Body} from '../js/CelestialBody';
import {Integrator} from "../js/PhysicsEngine";
import {FrameCounter} from "../js/frameCounter";


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit {
  title = 'gravitation-app';
  scene!: THREE.Scene;
  renderer!: THREE.WebGLRenderer;
  cameraReference!: THREE.PerspectiveCamera;
  mainCamera!: THREE.PerspectiveCamera;
  fakeCamera!: THREE.PerspectiveCamera; // needed to have a camera with parent null
  cameraControllerReference!: Controls.OrbitControls;
  mainCameraController!: Controls.OrbitControls;
  loader!: THREE.TextureLoader;

  @ViewChild('canvas')
  public canvasRef!: ElementRef;


  bodies: Body[] = [];
  availableSpeeds = [{
    physics_loop: 1,
    stepSize: 1 / 365 / 30 / 24 / 60,
    name: "minutes per second"
  },
    {
      physics_loop: 1,
      stepSize: 1 / 365 / 30 / 24,
      name: "hours per second"
    },
    {
      physics_loop: 1,
      stepSize: 1 / 365 / 30,
      name: "days per second"
    },
    {
      physics_loop: 7,
      stepSize: 1 / 365 / 30,
      name: "weeks per second"
    },
    {
      physics_loop: 30,
      stepSize: 1 / 365 / 30,
      name: "months per second"
    }];

  availableIntegrators = [{
    f: Integrator.euler,
    name: "simple euler method"
  },
    {
      f: Integrator.rk4,
      name: "4th order runge-kutta"
    }];

  simSpeed: any = this.availableSpeeds[2];
  integrator: any = this.availableIntegrators[0];

  /** UI control variables **/
  mousePosition = new THREE.Vector2();
  dragStart = new THREE.Vector3();
  dragEnd = new THREE.Vector3();
  dragVector = new THREE.Vector3();
  mouseDrag = false;
  bodiesListShown = false;
  showTrajectory = true;


  /** Time control variables **/
  frameCounter = new FrameCounter(1000);
  frameRate = 0;
  physicsTickCounter = new FrameCounter(33);
  pauseSimulation = false;

  /** New body generation objects **/

  newName = 'New';
  newMass = 10;
  newRadius = 1000;
  newVelocity = new THREE.Vector3(0, 5, 0);
  eclipticPlane!: THREE.Mesh;
  newBodySpeedArrow!: THREE.ArrowHelper;
  newBody!: THREE.Group;
  creation: boolean = false;

  /** Auxiliary objects **/
  axisHelper = new THREE.AxesHelper(1);
  gridHelper = new THREE.PolarGridHelper(10, 50, 100, 50);
  showAxes: boolean = false;
  showGrid: boolean = false;
  private systemBaryCenter: THREE.Object3D = new THREE.Object3D();


  constructor() {
    this.gridHelper.rotation.x = Math.PI / 2;

    this.loader = new THREE.TextureLoader();
  }


  ngOnInit() {

  }

  ngAfterViewInit() {

    this.initScene();
    this.initNewBodyObject();

    this.animate();
  }


  private initScene() {

    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({antialias: true});
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.canvasRef.nativeElement.appendChild(this.renderer.domElement);
    this.mainCamera = new THREE.PerspectiveCamera(
      40,
      window.innerWidth / window.innerHeight,
      0.00001,
      10000
    );
    this.mainCamera.position.set(1, -1, 1);
    this.mainCamera.up.set(0, 0, 1);
    this.fakeCamera = this.mainCamera.clone();
    this.mainCameraController = new Controls.OrbitControls(this.fakeCamera, this.renderer.domElement);
    this.mainCameraController.maxDistance = 100;
    this.mainCameraController.enableDamping = true;
    this.cameraControllerReference = this.mainCameraController;
    this.cameraReference = this.mainCamera;
    /** for testing only **/
      // this.controls.dampingFactor = 1.0;
      // this.controls.enableZoom = true;
    const texture = this.loader.load('assets/2k_stars_milky_way.jpg', () => {
        const renderTarget = new THREE.WebGLCubeRenderTarget(texture.image.height);
        renderTarget.fromEquirectangularTexture(this.renderer, texture);
        this.scene.background = renderTarget.texture;
      });

    this.scene.add(new THREE.AmbientLight(0x333333));
    this.initSolarSystem(this.scene);
    for (let body of this.bodies) {
      body.addAffectingBodies(this.bodies);
      body.setPivotObject(this.systemBaryCenter);
    }
  }

  private initNewBodyObject() {

    this.eclipticPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(100000, 100000),
      new THREE.MeshBasicMaterial({color: 0xffff00, side: THREE.DoubleSide}));

    this.newBodySpeedArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(), 100, 0xff0000);

    this.newBody = new THREE.Group();
    this.newBody.add(
      new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.03, 2),
        new THREE.MeshPhongMaterial({
          color: 0x000000,
          emissive: 0x072534,
          side: THREE.DoubleSide,
          flatShading: true
        })
      )
    );
    this.newBody.add(this.newBodySpeedArrow);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    /** FPS Counter **/
    if (this.frameCounter.isTime()) {
      this.frameRate = this.frameCounter.counter;
    }

    if (this.physicsTickCounter.isTime() && !this.pauseSimulation) {
      for (let i = 0; i < this.simSpeed.physics_loop; i++) {
        this.physicsTick();
      }
    }


    if (this.creation && !this.mouseDrag) {
      let newPos = this.pickVector3FromScene(this.eclipticPlane, this.mousePosition, this.cameraReference);
      this.newBody.position.set(newPos.x, newPos.y, newPos.z);
      this.cameraControllerReference.enabled = false;
    } else if (this.creation && this.mouseDrag) {
      this.dragEnd = this.pickVector3FromScene(this.eclipticPlane, this.mousePosition, this.cameraReference);
      this.dragVector = this.dragEnd.sub(this.dragStart);
      this.newVelocity.copy(this.dragVector).multiplyScalar(0.1);
      this.newBodySpeedArrow.setDirection(this.dragVector.clone().normalize());
      this.newBodySpeedArrow.setLength(this.dragVector.length());
      this.cameraControllerReference.enabled = false;
    } else {
      this.cameraControllerReference.enabled = true;
    }

    this.cameraReference.copy(this.fakeCamera);
    this.cameraControllerReference.update();
    this.renderer.render(this.scene, this.cameraReference);
  }

  toggleAxes() {
    if (this.showAxes)
      this.scene.add(this.axisHelper);
    else
      this.scene.remove(this.axisHelper);
  }

  toggleGrid() {
    if (this.showGrid)
      this.scene.add(this.gridHelper);
    else
      this.scene.remove(this.gridHelper);
  }

  toggleBodiesList() {
    this.bodiesListShown = !this.bodiesListShown;
  }

  toggleTrajectories() {
    for (let body of this.bodies) {
      body.toggleTrajectory(this.showTrajectory);
    }
  }

  resetCamera() {
    this.cameraReference = this.mainCamera;
    this.cameraControllerReference = this.mainCameraController;
    this.cameraControllerReference.update();
    for (let body of this.bodies){
      body.setPivotObject(this.systemBaryCenter);
    }
  }

  togglePause() {
    this.pauseSimulation = !(this.pauseSimulation && !this.creation);
  }

  createBody() {
    if (this.creation) {
      this.creation = false;
      this.pauseSimulation = false;
      this.scene.remove(this.newBody);
    } else {
      this.creation = true;
      this.pauseSimulation = true;
      this.newBody.position.x = 0.0;
      this.newBody.position.y = 0.0;
      this.newBody.position.z = 0.0;

      this.scene.add(this.newBody);
    }
  }

  remove(body: Body) {
    let i = this.bodies.indexOf(body);
    this.scene.remove(body.renderObject);
    this.bodies.splice(i, 1);
  }

  track(body: Body) {
    this.cameraReference = body.camera;
    this.fakeCamera = this.cameraReference.clone();
    this.cameraControllerReference = new Controls.OrbitControls(this.fakeCamera, this.renderer.domElement);
    for (let body_i of this.bodies){
      body_i.setPivotObject(body.renderObject);
    }
  }


  physicsTick() {
    let baryCenter = new THREE.Vector3();
    let totalMass = 0;
    for (let body of this.bodies) {
      body.physicsTick(0.0, this.simSpeed.stepSize, this.integrator.f);
      baryCenter.add(body.position.clone().multiplyScalar(body.mass));
      totalMass += body.mass;
    }
    this.systemBaryCenter.position.copy(baryCenter.multiplyScalar(1.0/totalMass));
  }

  pickVector3FromScene(plane: THREE.Mesh, mousePosition: THREE.Vector2, camera: THREE.Camera) {

    //todo: check whether the mouse on plane
    // update the picking ray with the camera and mouse position

    let raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mousePosition, camera);
    // calculate objects intersecting the picking ray
    let intersect = raycaster.intersectObject(plane);
    return intersect[0].point;
  }

  @HostListener('contextmenu', ['$event'])
  onRightClick(event: Event) {
    event.preventDefault();
  }

  @HostListener("window:mousedown", ["$event"])
  onMouseDown(event: MouseEvent) {
    switch (event.button) {
      case 0:
        let raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(this.mousePosition, this.cameraReference);
        for (let body of this.bodies) {
          //intersectObjects maybe?
          let intersect = raycaster.intersectObject(body.mainMesh);
          if (intersect.length > 0) {
            this.track(body);
            this.cameraControllerReference.maxDistance = 2;
            return;
          }
        }
        break;
      case 1:
        break;
      case 2:
        if (this.creation) {
          this.mouseDrag = true;
          this.dragStart = this.pickVector3FromScene(this.eclipticPlane, this.mousePosition, this.cameraReference);
        }
        break;
    }
  }

  @HostListener("window:mousemove", ["$event"])
  onMouseMove(event: MouseEvent) {
    // calculate mouse position in normalized device coordinates
    // (-1 to +1) for both components

    this.mousePosition.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
  }

  @HostListener("window:mouseup", ["$event"])
  onMouseUp(event: MouseEvent) {
    switch (event.button) {
      case 0:
        break;
      case 1:
        break;
      case 2:
        this.mouseDrag = false;
        if (this.creation) {
          this.creation = false;
          this.pauseSimulation = false;
          let newPlanet = new Body(this.newName, this.newMass, this.newRadius,
            this.newBody.position.clone(),
            this.newVelocity, this.scene, this.cameraReference);
          this.bodies.push(newPlanet);
          newPlanet.addAffectingBodies(this.bodies);
          newPlanet.setPivotObject(this.systemBaryCenter);
          newPlanet.toggleTrajectory(this.showTrajectory);
          this.scene.remove(this.newBody);
        }
        break;
    }
  }

  @HostListener("window:resize", [])
  onWindowResize() {
    this.cameraReference.aspect = window.innerWidth / window.innerHeight;
    this.cameraReference.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }


  initSolarSystem(scene: THREE.Scene) {
    this.bodies =
      [
        new Body("Sun", 19885440.0, 695500.0,
          new THREE.Vector3(-1.139090933890510E-03, 7.513548470174963E-03, -4.751221261400040E-05),
          new THREE.Vector3(-8.103340265234835E-06, 1.531073076683503E-06, 2.093972966295105E-07), scene, this.cameraReference),
        new Body("Mercury", 3.302, 2440,
          new THREE.Vector3(2.712325922922563E-01, 1.819716677932228E-01, -1.077866088275325E-02),
          new THREE.Vector3(-2.069213447486702E-02, 2.492058633634082E-02, 3.933933861696485E-03), scene, this.cameraReference,
          this.loader.load('assets/2k_mercury.jpg')),
        new Body("Venus", 48.685, 6052,
          new THREE.Vector3(-5.728936053119389E-01, -4.341301111844528E-01, 2.688719930686330E-02),
          new THREE.Vector3(1.221413056525722E-02, -1.610029029497521E-02, -9.260442405719175E-04), scene, this.cameraReference,
          this.loader.load("assets/2k_venus_atmosphere.jpg")),
        new Body("Earth", 59.7219, 6371,
          new THREE.Vector3(-8.461345399508943E-01, 5.198188201638625E-01, -6.874116231359140E-05),
          new THREE.Vector3(-9.202068150470241E-03, -1.477025937149794E-02, 2.181018061038459E-07), scene, this.cameraReference,
          this.loader.load("assets/2k_earth_daymap.jpg")),
        new Body("Mars", 6.4185, 3390,
          new THREE.Vector3(5.705339438331232E-01, 1.409846673537129E+00, 1.530908608548376E-02),
          new THREE.Vector3(-1.243732896484183E-02, 6.474674548082186E-03, 4.408245110899003E-04), scene, this.cameraReference,
          this.loader.load("assets/2k_mars.jpg")),
        new Body("Jupiter", 18981.3, 69911,
          new THREE.Vector3(-1.802834401723843E+00, -5.014280704579202E+00, 6.112364485199881E-02),
          new THREE.Vector3(7.010448905955205E-03, -2.193302255507297E-03, -1.477170884740540E-04), scene, this.cameraReference,
          this.loader.load("assets/2k_jupiter.jpg")),
        new Body("Saturn", 5683.19, 54364,
          new THREE.Vector3(2.206030955119386E+00, -9.805055204585239E+00, 8.267037770574978E-02),
          new THREE.Vector3(5.134836863993126E-03, 1.207623115706131E-03, -2.256603441981650E-04), scene, this.cameraReference,
          this.loader.load("assets/2k_saturn.jpg")),
        new Body("Uranus", 868.103, 24973,
          new THREE.Vector3(1.691576531998510E+01, 1.040299290535852E+01, -1.805089997039230E-01),
          new THREE.Vector3(-2.089225716511510E-03, 3.166920117890191E-03, 3.877872984759312E-05), scene, this.cameraReference,
          this.loader.load("assets/2k_uranus.jpg")),
        new Body("Neptune", 1024, 24342,
          new THREE.Vector3(2.901792701698493E+01, -7.334322263086601E+00, -5.177112691425811E-01),
          new THREE.Vector3(7.480486820282755E-04, 3.061681026453200E-03, -8.041857175667311E-05), scene, this.cameraReference,
          this.loader.load("assets/2k_neptune.jpg")),
        new Body("Pluto", 0.1307, 1195,
          new THREE.Vector3(1.202593741257323E+01, -3.151923742551384E+01, -1.058521747038058E-01),
          new THREE.Vector3(3.011947033149633E-03, 4.602992991939947E-04, -9.262560073082725E-04), scene, this.cameraReference),
        new Body("Moon", 0.7349, 1737,
          new THREE.Vector3(-8.475142757438984E-01, 5.217790085293892E-01, -3.489291919490877E-05),
          new THREE.Vector3(-9.707086464783627E-03, -1.514846336243542E-02, 5.686804539964647E-05), scene, this.cameraReference,
          this.loader.load("assets/2k_moon.jpg")),
        new Body("Io", 0.8933, 1821.3,
          new THREE.Vector3(-1.803461674299824E+00, -5.017016066105317E+00, 6.101532458745745E-02),
          new THREE.Vector3(1.681093262738421E-02, -4.425998369697550E-03, -8.929365860245689E-05), scene, this.cameraReference),
        new Body("Europa", 0.4797, 1565,
          new THREE.Vector3(-1.802718529157627E+00, -5.009841513771999E+00, 6.131122220507163E-02),
          new THREE.Vector3(-9.951954324951590E-04, -1.990570620441508E-03, -3.013171422482668E-04), scene, this.cameraReference),
        new Body("Ganymede", 1.482, 2634,
          new THREE.Vector3(-1.803393500006158E+00, -5.007138501949056E+00, 6.138663186582697E-02),
          new THREE.Vector3(7.577993506601293E-04, -2.670678131208378E-03, -2.497152309340046E-04), scene, this.cameraReference),
        new Body("Callisto", 1.076, 2403,
          new THREE.Vector3(-1.792389695292648E+00, -5.021172909160833E+00, 6.104623329240919E-02),
          new THREE.Vector3(9.615925658317278E-03, 1.792745159721033E-03, 1.303759011804029E-05), scene, this.cameraReference),
        new Body("Mimas", 0.000375, 198.8,
          new THREE.Vector3(2.206966977314742E+00, -9.804420479623756E+00, 8.221453673165265E-02),
          new THREE.Vector3(-2.595135014510252E-04, 7.074468781161957E-03, -2.908007177350689E-03), scene, this.cameraReference),
        new Body("Enceladus", 0.0010805, 252.3,
          new THREE.Vector3(2.204638276174967E+00, -9.804340379440230E+00, 8.243111278267680E-02),
          new THREE.Vector3(1.697836985568966E-03, -4.385143468595405E-03, 3.038398441866367E-03), scene, this.cameraReference),
        new Body("Tethys", 0.006176, 536.3,
          new THREE.Vector3(2.205602840072827E+00, -9.803331125560392E+00, 8.181916434528755E-02),
          new THREE.Vector3(-1.227666348277735E-03, 2.488559072102069E-04, 1.030161338307698E-03), scene, this.cameraReference),
        new Body("Dione", 0.0109572, 562.5,
          new THREE.Vector3(2.208170227883550E+00, -9.806316829148340E+00, 8.312519452707669E-02),
          new THREE.Vector3(8.177966907724791E-03, 5.439796282238727E-03, -2.739394017812531E-03), scene, this.cameraReference),
        new Body("Rhea", 0.02309, 764.5,
          new THREE.Vector3(2.205589073048511E+00, -9.801937369011631E+00, 8.108681075388574E-02),
          new THREE.Vector3(2.907319229277102E-04, 8.448026517563254E-04, 4.026828776387365E-04), scene, this.cameraReference),
        new Body("Titan", 1.34553, 2575.5,
          new THREE.Vector3(2.199037116790120E+00, -9.808740923776030E+00, 8.526550701861015E-02),
          new THREE.Vector3(6.880458180258838E-03, -1.199004465277587E-03, 8.411529200613504E-04), scene, this.cameraReference),
        new Body("Iapetus", 0.018059, 734.5,
          new THREE.Vector3(2.195986189899942E+00, -9.825961895589282E+00, 8.953813277930124E-02),
          new THREE.Vector3(6.801435775216020E-03, 4.060803327326771E-04, -3.770615884942251E-04), scene, this.cameraReference)
      ];
    this.systemBaryCenter = this.bodies[0].renderObject;
    /** Point Light for sun **/
    let sunLight = new THREE.PointLight(0xffffff, 10);
    sunLight.castShadow = true;
    this.bodies[0].addExtraRenderObjects(sunLight);


    /** Saturns ring **/
    let ringTexture = this.loader.load("assets/2k_saturn_ring_alpha.png");
    //ring_texture.rotation = math.PI/2;
    //ring_texture.updateMatrix();
    let ringGeometry = new THREE.RingGeometry(1.005 * 60300/150E+6, 60300/150E+6 * 1.705, 32);
    let pos = ringGeometry.getAttribute("position");
    let v3 = new THREE.Vector3();
    for (let i =0; i < pos.count; i++){
      v3.fromBufferAttribute(pos, i);
      ringGeometry.getAttribute("uv").setXY(i, v3.length() < 1.2 * 60300 / 150E+6 ? 0 : 1, 1);
    }
    let ring_material = new THREE.MeshPhongMaterial({
      map: ringTexture, transparent: true, emissive: this.bodies[6].color, emissiveIntensity: 0.2
    });
    let ringMesh = new THREE.Mesh(ringGeometry, ring_material);
    // ringMesh.rotateX(-Math.PI/2);
    this.bodies[6].addExtraRenderObjects(ringMesh);
  }
}
