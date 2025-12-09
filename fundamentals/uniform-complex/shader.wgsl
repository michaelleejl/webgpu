struct Uniform {
    scale  : vec2f,
    offset : vec2f,
    color  : vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniform;

@vertex fn vs(
    @builtin(vertex_index) vertexIdx: u32
) -> @builtin(position) vec4f {
    let positions = array(
        vec2f( 0.0,  0.5),
        vec2f(-0.5, -0.5),
        vec2f( 0.5, -0.5)
    );
    return vec4f((positions[vertexIdx] + uni.offset) * uni.scale, 0, 1);
}

@fragment fn fs() -> @location(0) vec4f {
   return uni.color;
};
