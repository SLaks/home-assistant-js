
type Gender = 'milchig' | 'pareve' | 'fleishig';
export interface SupperInfo {
    name: string;
    gender: Gender;
    image: string;
    actions: SupperActionInfo[];
}

export interface SupperForDate extends SupperInfo {
    date: string;
}

export interface DurationInfo {
    str: string;
    millis: number;
}

export interface SupperActionInfo {
    name: string;
    icon: string;
    time: DurationInfo;
    total_time: DurationInfo;
}