const rand = (min, max) => {
    if (min === undefined) {
        min = 0;
        max = 1;
    }
    else if (max === undefined) {
        max = min;
        min = 0;
    }
    return min + Math.random() * (max - min);
};

function createCircleVertices() {
    const radius = 1;
    const numSubdivisions = 24;
    const innerRadius = 0;
    const startAngle = 0;
    const endAngle = Math.PI * 2;
    // 2 triangles per subdivision, 3 verts per tri, 2 values (xy) each.
    const numVertices = numSubdivisions * 3 * 2;
    const vertexData = new Array(numVertices * 2);
    let offset = 0;
    const addVertex = (x, y) => {
        vertexData[offset++] = x;
        vertexData[offset++] = y;
    };
    // 2 triangles per subdivision
    //
    // 0--1 4
    // | / /|
    // |/ / |
    // 2 3--5
    for (let i = 0; i < numSubdivisions; ++i) {
        const angle1 = startAngle + (i + 0) * (endAngle - startAngle) / numSubdivisions;
        const angle2 = startAngle + (i + 1) * (endAngle - startAngle) / numSubdivisions;
        const c1 = Math.cos(angle1);
        const s1 = Math.sin(angle1);
        const c2 = Math.cos(angle2);
        const s2 = Math.sin(angle2);
        // first triangle
        addVertex(c1 * radius, s1 * radius);
        addVertex(c2 * radius, s2 * radius);
        addVertex(c1 * innerRadius, s1 * innerRadius);
        // second triangle
        addVertex(c1 * innerRadius, s1 * innerRadius);
        addVertex(c2 * radius, s2 * radius);
        addVertex(c2 * innerRadius, s2 * innerRadius);
    }
    return vertexData;
}
async function storageCircles() {
    let adapter = await navigator.gpu?.requestAdapter();
    let device = await adapter.requestDevice();
    if (!device) {
        console.log("No GPU");
        return;
    }
    let format = navigator.gpu.getPreferredCanvasFormat();
    let canvas = document.querySelector('canvas');
    let context = canvas.getContext('webgpu');
    context.configure({ device, format });
    let module = device.createShaderModule({
        code: /*wgsl*/ `
            struct Uniform {
                scale: array<vec2f, 100>,
                offset: array<vec2f, 100>,
                color: array<vec4f, 100>,
                vertices: array<vec2f, 144>,
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
                var is: InterStage;
                let s = uni.scale[idx / 144];
                let o = uni.offset[idx / 144];
                let c = uni.color[idx / 144];
                let xy = (uni.vertices[idx % 144] + o) * s;
                is.positionData = vec4f(xy, 0, 1);
                is.colorData    = c;
                return is;
            }

            @fragment fn fs(is: InterStage) -> @location(0) vec4f {
                return is.colorData;
            }
        `
    });
    let pipeline = device.createRenderPipeline({
        vertex: { module },
        layout: "auto",
        fragment: { module, targets: [{ format }] }
    });
    let n = 100;
    let bufferSize = 4 * ((n * 8) + 144 * 2);
    let buffer = device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    });
    let group = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{
                binding: 0,
                resource: { buffer }
            }]
    });
    let values = new Float32Array(bufferSize / 4);
    let sOffset = 0;
    let oOffset = 2 * n;
    let cOffset = (2 + 2) * n;
    let vOffset = 8 * n;
    for (let i = 0; i < n; i++) {
        values.set([rand(0.2, 0.5), rand(0.2, 0.5)], sOffset + 2 * i);
        values.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], oOffset + 2 * i);
        values.set([rand(0, 1), rand(0, 1), rand(0, 1), 1], cOffset + 4 * i);
    }
    console.log(values)
    console.log(vOffset)
    const vertices = createCircleVertices()
    console.log(vertices.length)
    values.set(vertices, vOffset);
    let encoder = device.createCommandEncoder();
    let pass = encoder.beginRenderPass({
        colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: { r: 1, g: 1, b: 1, a: 1 }
            }]
    });
    pass.setPipeline(pipeline);
    device.queue.writeBuffer(buffer, 0, values);
    pass.setBindGroup(0, group);
    pass.draw(144 * n);
    pass.end();
    device.queue.submit([encoder.finish()]);
}
storageCircles();
