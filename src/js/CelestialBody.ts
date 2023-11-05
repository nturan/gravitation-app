import {GenericIntegrator, PhysicsBody} from 'src/js/PhysicsEngine';
import {
  Vector3,
  Mesh,
  IcosahedronGeometry,
  MeshPhongMaterial,
  Object3D,
  Texture,
  Matrix3,
  CatmullRomCurve3, Scene, Line, LineBasicMaterial, BufferGeometry, Group, PerspectiveCamera
} from 'three';
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {Gravity} from "./Gravity";

export class Body {


  private _name: string;
  private readonly _radius: number;
  private readonly _mass: number;
  private _position: Vector3;
  private _velocity: Vector3;
  private _physicsBody: PhysicsBody;
  private _affectingBodies: Body[] = [];
  private readonly _color: number = 0xffffff;
  private _trajectory: Vector3[] = [];
  private _trajectoryObject: Object3D | null = null;
  private _trajectoryPivotObject: Object3D = new Object3D();
  private _renderObject: Group = new Group();
  private _mainMesh: Object3D;
  private readonly _trajectoryLength: number = 150;
  private _sceneReference: Scene;
  private _camera: PerspectiveCamera;
  private _physicsTickCounter: number = 0;
  private _trajectoryLogInterval: number = 10;
  private _showTrajectory: Boolean = true;

  constructor(name: string, mass: number, radius: number,
              initial_position: Vector3, initial_velocity: Vector3, sceneReference: Scene, cameraReference: PerspectiveCamera, texture: Texture | null = null) {
    this._name = name;
    this._mass = mass / 18981.3;
    this._radius = radius / 150E+6;//0.01AU = km*1E-6
    this._position = initial_position;
    this._velocity = initial_velocity.multiplyScalar(365.25);
    this._physicsBody = new PhysicsBody(
      this._mass, this._position, this._velocity,
      () => this.calculateInertiaTensor());
    this._sceneReference = sceneReference;
    this._camera = cameraReference.clone();
    this._camera.position.copy(new Vector3(1, 1, 1).normalize().multiplyScalar(this._radius*5));
    this._camera.up.set(0, 0, 1);

    interface MaterialParams {
      color?: number,
      emissive?: number,
      map?: Texture,
      emissiveMap?: Texture,
      emissiveIntensity: number
    }

    let geometry = new IcosahedronGeometry(this._radius, 2);
    let params: MaterialParams = {emissive: this._color, emissiveIntensity: 0.1};
    if (texture !== null) {
      params.map = texture;
      params.emissiveMap = texture;
    } else {
      params.color = this._color;
    }

    let material = new MeshPhongMaterial(params);
    this._mainMesh = new Mesh(geometry, material);
    this._mainMesh.name = this._name;
    this._mainMesh.rotateX(Math.PI/2);
    this._renderObject.add(this._mainMesh);
    this._renderObject.add(this._camera);
    this._renderObject.position.copy(this._position);
    this._sceneReference.add(this._renderObject);
  }

  get name(): string {
    return this._name;
  }

  get radius() {
    return this._radius;
  }

  get mass() {
    return this._mass;
  }

  get position() {
    return this._position;
  }

  get velocity() {
    return this._velocity;
  }

  get mainMesh() {
    return this._mainMesh;
  }

  get trajectoryObject() {
    return this._trajectoryObject;
  }

  get trajectory() {
    return this._trajectory;
  }

  set trajectory(trajectory) {
    this._trajectory = trajectory;
  }

  get color() {
    return this._color;
  }

  get physicsBody(): PhysicsBody {
    return this._physicsBody;
  }
  get renderObject(): Group {
    return this._renderObject;
  }
  get camera(): PerspectiveCamera {
    return this._camera;
  }


  toggleTrajectory(showTrajectory: Boolean) {
    this._showTrajectory = showTrajectory;
  }

  physicsTick(t: number, stepSize: number, integrator: GenericIntegrator) {
    this.applyGravity();
    this._physicsBody.UpdateStateVector(t, stepSize, integrator);
    this._position = this._physicsBody.position;
    this._velocity = this._physicsBody.velocity;
    this._renderObject.position.copy(this._position);
    /** TODO introduce proper way to do this **/
    this._mainMesh.rotateOnAxis(new Vector3(0, 1, 0), 2.0 * Math.PI / 365.5);
    this.logTrajectory();
  }

  calculateInertiaTensor() {
    let momentOfInertia = 0.4 * this._mass * this._radius * this._radius; /** for a sphere **/
    return new Matrix3().identity().multiplyScalar(momentOfInertia);
  }

  applyGravity() {
    Gravity.applyGravity(this, this._affectingBodies);
  }

  private logTrajectory() {
    if (this._physicsTickCounter > this._trajectoryLogInterval) {
      this._physicsTickCounter = 0;
      this._trajectory.push(this._position.clone().sub(this._trajectoryPivotObject.position));
    } else {
      this._physicsTickCounter++;
      this._trajectory[-1] = this._position.clone().sub(this._trajectoryPivotObject.position);
    }
    if (this.trajectory.length > this._trajectoryLength) {
      this._trajectory.shift();
    }

    if (this._trajectoryObject)
      this._trajectoryObject.removeFromParent();
      this._trajectoryObject = null;
    if (this._trajectory.length > 3 && this._showTrajectory) {
      // this.shiftTrajectoryByPivot();
      let curve = new CatmullRomCurve3(this.trajectory);
      this._trajectoryObject = new Line(
        new BufferGeometry().setFromPoints(curve.getPoints(100)),
        new LineBasicMaterial({color: this.color, linewidth: 5})
      );
      this._trajectoryPivotObject.add(this._trajectoryObject);
    }
  }

  addAffectingBodies(affectingBodies: Body[]) {
    this._affectingBodies = affectingBodies;
  }

  setPivotObject(pivotObject: Object3D) {
    this._trajectoryPivotObject = pivotObject;
    this._trajectory = []; // TODO: shift old trajectories in the future
  }

  addExtraRenderObjects(extraObject: Object3D){
    this._renderObject.add(extraObject);
  }
}

