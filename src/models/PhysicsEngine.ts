import {add, index, Matrix, matrix, multiply} from 'mathjs';
import * as THREE from "three";

interface InertiaCalculator {
  (): THREE.Matrix3;
}

export interface GenericIntegrator {
  (fun: GenericRightHandSideFunction, x: Matrix, t: number, step: number, arg: any[]): Matrix;
}

interface GenericRightHandSideFunction {
  (t: number, x: Matrix, arg: any[]): Matrix;
}


export class PhysicsBody {
  get velocity() {
    return this._velocity;
  }

  private readonly _mass;
  private _position;
  private _velocity;
  private _acceleration: THREE.Vector3;
  private _quaternion;
  private _inertiaTensor: THREE.Matrix3;
  private _totalForceOnBody: THREE.Vector3;
  private _totalTorqueOnBody: THREE.Vector3;
  private _w: THREE.Vector3;
  private _L: THREE.Vector3;
  private _euler: THREE.Euler;
  private _inertiaTensorCalculator: InertiaCalculator;
  private _stateVector: Matrix = matrix();


  constructor(mass: number, position: THREE.Vector3, velocity: THREE.Vector3,
              InertiaTensorCalculator = PhysicsBody.DefaultInertiaTensorCalculator) {
    this._mass = mass;
    this._position = position;
    this._velocity = velocity;
    this._inertiaTensorCalculator = InertiaTensorCalculator;
    this._inertiaTensor = this._inertiaTensorCalculator();
    this._totalForceOnBody = new THREE.Vector3();
    this._totalTorqueOnBody = new THREE.Vector3();
    this._acceleration = new THREE.Vector3();
    this._quaternion = new THREE.Quaternion();
    this._w = new THREE.Vector3();
    this._L = this._w.clone().applyMatrix3(this._inertiaTensor);
    this._euler = new THREE.Euler();
    this._euler.setFromQuaternion(this._quaternion);
    this._refillStateVector();
  }

  private _refillStateVector() {
    this._stateVector = matrix(
      [
        this._position.x,
        this._position.y,
        this._position.z,
        this._velocity.x * this._mass,
        this._velocity.y * this._mass,
        this._velocity.z * this._mass,
        this._quaternion.x,
        this._quaternion.y,
        this._quaternion.z,
        this._quaternion.w,
        this._L.x,
        this._L.y,
        this._L.z
      ]);
  }

  ApplyForce(newForce: THREE.Vector3) {
    this._totalForceOnBody.add(newForce);
  }

  ApplyTorque(newTorque: THREE.Vector3) {
    this._totalTorqueOnBody.add(newTorque);
  }


  UpdateStateVector(t: number, step: number, integrator: GenericIntegrator) {
    this._stateVector = integrator((t_: number, x_: Matrix, arg_: any[]) => this.dxdt(t_, x_, arg_), this._stateVector, t, step, []);
    this._applyStateVector();
  }

  private _applyStateVector() {

    this._position.fromArray(
      this._stateVector.subset(index([0, 1, 2])).toArray() as number[]);

    this._velocity.fromArray(
      this._stateVector.subset(index([3, 4, 5])).toArray() as number[]).multiplyScalar(1.0 / this._mass);

    this._quaternion.fromArray(
      this._stateVector.subset(index([6, 7, 8, 9])).toArray() as number[]).normalize();
    this._euler.setFromQuaternion(this._quaternion);
    this._inertiaTensor = this._inertiaTensorCalculator();
    this._L.fromArray(
      this._stateVector.subset(index([10, 11, 12])).toArray() as number []);
    this._w = this._L.clone().applyMatrix3(this._inertiaTensor.clone().invert());

    this._totalForceOnBody = new THREE.Vector3();
    this._totalTorqueOnBody = new THREE.Vector3();
    this._refillStateVector();
  }

  dxdt(t: number, x: Matrix, arg: any[]) {
    /** we cannot really take this._stateVector here, because x gets modified when calculating ki vectors. **/
    let v = new THREE.Vector3().fromArray(
      x.subset(index([3, 4, 5])).toArray() as number[]).multiplyScalar(1.0 / this._mass);
    let q = new THREE.Quaternion().fromArray(
      x.subset(index([6, 7, 8, 9])).toArray() as number[]).normalize();
    let L = new THREE.Vector3().fromArray(
      x.subset(index([10, 11, 12])).toArray() as number []);
    let w = L.applyMatrix3(this._inertiaTensor.clone().invert());
    q.multiply(new THREE.Quaternion(w.x, w.y, w.z, 0.0));


    return matrix([v.x, v.y, v.z, //velocity
      this._totalForceOnBody.x, this._totalForceOnBody.y, this._totalForceOnBody.z, // linear momentum
      1 / 2 * q.x, 1 / 2 * q.y, 1 / 2 * q.z, 1 / 2 * q.w, //rotation
      this._totalTorqueOnBody.x, this._totalTorqueOnBody.y, this._totalTorqueOnBody.z //angular momentum
    ]);
  }

  get position() {
    return this._position;
  }

  static DefaultInertiaTensorCalculator() {
    return new THREE.Matrix3().identity();
  }
}


export class Integrator {
  static euler(fun: GenericRightHandSideFunction, x: Matrix, t: number, step: number, arg: any[]): Matrix {
    let k1 = fun(t, x, arg);
    return add(x, multiply(step, k1));
  }

  static rk4(fun: GenericRightHandSideFunction, x: Matrix, t: number, step: number, arg: any[]) {

    let k1 = fun(t, x, arg);
    let k2 = fun(t + step / 2, add(x, multiply(step / 2, k1)), arg);
    let k3 = fun(t + step / 2, add(x, multiply(step / 2, k2)), arg);
    let k4 = fun(t + step, add(x, multiply(step, k3)), arg);

    let scaledK2 = multiply(2, k2);
    let scaledK3 = multiply(2, k3);
    let sumOfK = add(add(k1, scaledK2), add(scaledK3, k4));
    let scaledSumOfK = multiply(step / 6, sumOfK);


    return add(x, scaledSumOfK);
  }
}
