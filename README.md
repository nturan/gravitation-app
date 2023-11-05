# GravitationApp
A demonstration of the N-Body-simulation.

Numerical Integration of differential equations (in this case gravity law) is performed
with [runge-kutta method](https://en.wikipedia.org/wiki/Runge%E2%80%93Kutta_methods).
There is also a possibility to choose simpler [euler integration method](https://en.wikipedia.org/wiki/Euler_method).

Initial values for velocities and positions of the celestial bodies in our solar system
are taken from [HORIZONS](https://ssd.jpl.nasa.gov/horizons.cgi)
Telnet Server of NASA.

I used my own implementation of a simple [physics engine](https://github.com/nturan/physics_engine).

3D visualisation made possible thanks to [threejs](https://github.com/mrdoob/three.js/)




## Reference ##
- For planetary textures visit [SolarSystemScope](https://www.solarsystemscope.com/about)

## License ##
The Code is licensed under MIT Public License.

## ToDo ##
- [ ] Add halo effect for the sun.
- [ ] Adjust new object creation plane. E.g. tilting, moving, anchoring focused objects etc.
- [ ] Add an option to automatically adjust the list of gravitationally affecting bodies. 
For example Jupiter's moons don't need to be affected by Mercury and vise versa.
- [ ] Extract mouse control implementation to separate class.
- [ ] Add tooltips
