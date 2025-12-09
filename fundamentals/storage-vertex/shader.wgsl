struct Uniform {
    scale: array<vec2f, 100>,
    offset: array<vec2f, 100>,
    color: array<vec4f, 100>,
};

struct InterStage {
    @builtin(position) positionData: vec4f,
    @location(0)       colorData   : vec4f,
}

@group(0) @binding(0)
var<storage> uni: Uniform;

@vertex fn vs(
    @builtin(vertex_index) idx: u32
) -> InterStage {
    let positions = array(
        vec2f( 0.0, 0.5),
        vec2f(-0.5,-0.5),
        vec2f( 0.5,-0.5)
    );
    var is: InterStage;
    let s = uni.scale[idx / 3];
    let o = uni.offset[idx / 3];
    let c = uni.color[idx / 3];
    let xy = (positions[idx % 3] + o) * s;
    is.positionData = vec4f(xy, 0, 1);
    is.colorData    = c;
    return is;
}

@fragment fn fs(is: InterStage) -> @location(0) vec4f {
    return is.colorData;
}
