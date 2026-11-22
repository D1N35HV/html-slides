/**
 * Basic SCORM 1.2 API Wrapper
 */
export class SCORM_API_Wrapper {
  private api: any = null;

  constructor() {
    this.api = this.findAPI(window);
  }

  private findAPI(win: Window): any {
    let findAttempts = 0;
    while (win.API == null && win.parent != null && win.parent !== win) {
      findAttempts++;
      if (findAttempts > 7) {
        return null;
      }
      win = win.parent;
    }
    return win.API;
  }

  public init(): boolean {
    if (this.api) {
      return this.api.LMSInitialize("") === "true" || this.api.LMSInitialize("") === true;
    }
    return false;
  }

  public finish(): boolean {
    if (this.api) {
      return this.api.LMSFinish("") === "true" || this.api.LMSFinish("") === true;
    }
    return false;
  }

  public setStatus(status: 'passed' | 'completed' | 'failed' | 'incomplete'): boolean {
    if (this.api) {
      return this.api.LMSSetValue("cmi.core.lesson_status", status) === "true" || this.api.LMSSetValue("cmi.core.lesson_status", status) === true;
    }
    return false;
  }

  public setScore(score: number): boolean {
    if (this.api) {
      return this.api.LMSSetValue("cmi.core.score.raw", score.toString()) === "true" || this.api.LMSSetValue("cmi.core.score.raw", score.toString()) === true;
    }
    return false;
  }
  
  public setLocation(location: string): boolean {
    if (this.api) {
      return this.api.LMSSetValue("cmi.core.lesson_location", location) === "true" || this.api.LMSSetValue("cmi.core.lesson_location", location) === true;
    }
    return false;
  }

  public commit(): boolean {
    if (this.api) {
      return this.api.LMSCommit("") === "true" || this.api.LMSCommit("") === true;
    }
    return false;
  }
}

export const scormAPI = new SCORM_API_Wrapper();
