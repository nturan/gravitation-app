import {Vector3} from "three";
import {Body} from "./CelestialBody";

export class Gravity {
  // constants
  static G = 0.03765;
  static eps = 1.0E-10;

  static applyGravity(body_i: Body, affectingBodies: Body[]) {
    let gravity_force_on_i = new Vector3();
    for (let body_j of affectingBodies) {
      if (body_i !== body_j) {
        let diffVector = new Vector3().subVectors(body_j.position, body_i.position);

        let distance: number = diffVector.length() + Gravity.eps;
        let distanceCubed: number = distance * distance * distance;

        gravity_force_on_i.add(diffVector.multiplyScalar(Gravity.G * body_j.mass * body_i.mass / distanceCubed));
      }
    }
    body_i.physicsBody.ApplyForce(gravity_force_on_i);
  }
}
