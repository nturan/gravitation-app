export class FrameCounter{
  private _counter: number = 0;
  private _startTime: number;
  private readonly _interval: number;
  private _lastCounter: number;

  constructor(interval:number) {
    this._counter = 0;
    this._lastCounter = 0;
    this._interval = interval;
    this._startTime = new Date().getTime();
  }

  get counter(){
    return this._lastCounter;
  }

  isTime(): Boolean {
    let currentTime = new Date().getTime();
    if (currentTime - this._startTime >= this._interval){
      this._startTime = currentTime;
      this._lastCounter = this._counter;
      this._counter = 0;
      return true;
    } else {
      this._counter++;
      return false;
    }
  }
}
