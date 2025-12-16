function matmul(a, b) {
    var aNumRows = a.length, aNumCols = a[0].length, bNumRows = b.length, bNumCols = b[0].length, m = new Array(aNumRows);
    for (var r = 0; r < aNumRows; ++r) {
        m[r] = new Array(bNumCols);
        for (var c = 0; c < bNumCols; ++c) {
            m[r][c] = 0;
            for (var i = 0; i < aNumCols; ++i) {
                m[r][c] += a[r][i] * b[i][c];
            }
        }
    }
    return m;
}
function transpose(a) {
    var r = a.length, c = a[0].length, m = new Array(c);
    for (var j = 0; j < c; ++j) {
        m[j] = new Array(r);
        for (var i = 0; i < r; ++i) {
            m[j][i] = a[i][j];
        }
    }
    return m;
}
function flatten(xss) {
    return xss.reduce((acc, curr) => acc.concat(curr), []);
}
async function normals() {
    let adapter = await navigator.gpu?.requestAdapter();
    let device = await adapter.requestDevice();
    if (!device) {
        console.log("No suitable GPU found");
    }
    let format = navigator.gpu?.getPreferredCanvasFormat();
    let canvas = document.querySelector('canvas');
    let context = canvas.getContext('webgpu');
    context.configure({ device, format });
    const module = device.createShaderModule({
        code: /*wgsl*/ `
        struct VertexInput {
            @builtin(vertex_index) vertexIndex: u32,
            @location(0) position: vec3f,
            @location(1) color: vec4f,
            @location(2) normal: vec3f,
        }

        struct VertexOutput {
            @builtin(position) position: vec4f,
            @interpolate(flat) @location(0) color: vec4f,
            @interpolate(flat) @location(1) normal: vec3f
        }

        struct FragmentOutput {
            @location(0) color: vec4f
        }

        @group(1) @binding(0) var<uniform> modelMatrix: mat4x4f;
        @group(0) @binding(0) var<uniform> viewMatrix: mat4x4f;
        @group(0) @binding(1) var<uniform> projectionMatrix: mat4x4f;

        @vertex fn vs_main (in: VertexInput) -> VertexOutput {
            let pos = projectionMatrix*viewMatrix * modelMatrix * vec4f(in.position, 1.0);
            var out: VertexOutput;
            out.position = pos;
            out.color = in.color;
            out.normal = normalize((modelMatrix * vec4f(in.normal, 1.0)).xyz);
            return out;
        }

        @fragment fn fs_main(in: VertexOutput) -> FragmentOutput{
            var out: FragmentOutput;
            let lightColor1 = vec3f(1.0, 0.9, 0.6);
        let lightColor2 = vec3f(0.6, 0.9, 1.0);
            let lightDirection1 = vec3f(0.5, -0.9, 0.1);
            let lightDirection2 = vec3f(0.2, 0.4, 0.3);
            let shading1 = max(0.0, dot(lightDirection1, in.normal));
            let shading2 = max(0.0, dot(lightDirection2, in.normal));
            out.color = vec4f(in.color.xyz * (shading1 * lightColor1 + shading2 * lightColor2), 1.0);
            return out;
        }
        `
    });
    const pipeline = device.createRenderPipeline({
        vertex: {
            module,
            buffers: [
                {
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x3' },
                        { shaderLocation: 2, offset: 12, format: 'float32x3' },
                        { shaderLocation: 1, offset: 24, format: 'unorm8x4' },
                    ],
                    arrayStride: 28
                }
            ]
        },
        fragment: {
            module,
            targets: [{ format }]
        },
        depthStencil: {
            format: "depth24plus",
            depthCompare: "less",
            depthWriteEnabled: true,
            stencilReadMask: 0,
            stencilWriteMask: 0,
        },
        layout: "auto"
    });
    let vertices = [
        [-0.53, -0.53, -0.3],
        [0.53, -0.53, -0.3],
        [0.53, 0.53, -0.3],
        [-0.53, 0.53, -0.3],
        [0.0, 0.0, 0.53],
    ];
    let indices = [
        0, 1, 2, 0, 2, 3, 0, 4, 1, 1, 4, 2, 2, 4, 3, 3, 4, 0
    ];
    let blue = [255, 255, 255, 255];
    let normals = [
        [+0.0, +0.0, -1.0],
        [+0.0, +0.0, -1.0],
        [+0.0, +0.0, -1.0],
        [+0.0, +0.0, -1.0],
        [+0.0, +0.0, -1.0],
        [+0.0, +0.0, -1.0],
        [+0.0, -0.848, +0.53],
        [+0.0, -0.848, +0.53],
        [+0.0, -0.848, +0.53],
        [+0.848, +0.0, +0.53],
        [+0.848, +0.0, +0.53],
        [+0.848, +0.0, +0.53],
        [+0.0, +0.848, +0.53],
        [+0.0, +0.848, +0.53],
        [+0.0, +0.848, +0.53],
        [-0.848, +0.0, +0.53],
        [-0.848, +0.0, +0.53],
        [-0.848, +0.0, +0.53],
    ];
    let vertexData = new Float32Array(7 * indices.length);
    let colorData = new Uint8Array(vertexData.buffer);
    let normalData = new Float32Array(vertexData.buffer);
    for (let i = 0; i < indices.length; i++) {
        let j = indices[i];
        vertexData.set(vertices[j], i * 7);
        colorData.set(blue, 4 * (6 + (7 * i)));
        normalData.set(normals[i], 3 + i * 7);
    }
    let vertexAndColorBuffer = device.createBuffer({
        size: vertexData.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
    });
    let modelMatrixBuffer = device.createBuffer({
        size: 4 * 4 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    let viewMatrixBuffer = device.createBuffer({
        size: 4 * 4 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    let projMatrixBuffer = device.createBuffer({
        size: 4 * 4 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    let bindGroup0 = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: viewMatrixBuffer } },
            { binding: 1, resource: { buffer: projMatrixBuffer } },
        ]
    });
    let bindGroup1 = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(1),
        entries: [
            { binding: 0, resource: { buffer: modelMatrixBuffer } },
        ]
    });
    let depthTexture = device.createTexture({
        size: [canvas.width, canvas.height, 1],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    let cf = Math.cos(-3.0 * Math.PI / 4.0);
    let sf = Math.sin(-3.0 * Math.PI / 4.0);
    let focalLength = 2.0;
    let near = 0.1;
    let far = 10.0;
    let Rv = transpose([
        [1.0, 0.0, 0.0, 0.0],
        [0.0, cf, -sf, 0.0],
        [0.0, sf, cf, 0.0],
        [0.0, 0.0, 0.0, 1.0]
    ]);
    let Tv = transpose([
        [1.0, 0.0, 0.0, 0.0],
        [0.0, 1.0, 0.0, 0.0],
        [0.0, 0.0, 1.0, 5.0],
        [0.0, 0.0, 0.0, 1.0]
    ]);
    let viewMatrix = flatten(matmul(Rv, Tv));
    let viewMatrixData = new Float32Array(viewMatrix);
    let projMatrix = flatten(transpose([
        [focalLength, 0, 0, 0],
        [0, focalLength * 2.0, 0, 0],
        [0, 0, far / (far - near), -(far * near) / (far - near)],
        [0, 0, 1, 0],
    ]));
    let S = transpose([[0.3, 0.0, 0.0, 0.0],
        [0.0, 0.3, 0.0, 0.0],
        [0.0, 0.0, 0.3, 0.0],
        [0.0, 0.0, 0.0, 1.0]]);
    let Ts = transpose([[1.0, 0.0, 0.0, 0.4],
        [0.0, 1.0, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0]]);
    let M1 = matmul(S, Ts);
    let projMatrixData = new Float32Array(projMatrix);
    var angle = 0.0;
    device.queue.writeBuffer(vertexAndColorBuffer, 0, vertexData, 0);
    device.queue.writeBuffer(viewMatrixBuffer, 0, viewMatrixData, 0);
    device.queue.writeBuffer(projMatrixBuffer, 0, projMatrixData, 0);
    function frame() {
        let c = Math.cos(angle);
        let s = Math.sin(angle);
        angle += 0.01;
        let R1 = transpose([
            [c, -s, 0.0, 0.0],
            [s, c, 0.0, 0.0],
            [0.0, 0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0]
        ]);
        let modelMatrix = flatten(matmul(M1, R1));
        let modelMatrixData = new Float32Array(modelMatrix);
        device.queue.writeBuffer(modelMatrixBuffer, 0, modelMatrixData, 0);
        let encoder = device.createCommandEncoder();
        let pass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: context.getCurrentTexture().createView(),
                    loadOp: 'clear',
                    storeOp: 'store',
                    clearValue: [1.0, 1.0, 1.0, 1.0],
                }
            ],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthLoadOp: 'clear',
                depthClearValue: 1.0,
                depthStoreOp: 'store',
            }
        });
        pass.setVertexBuffer(0, vertexAndColorBuffer);
        pass.setBindGroup(0, bindGroup0);
        pass.setBindGroup(1, bindGroup1);
        pass.setPipeline(pipeline);
        pass.draw(indices.length);
        pass.end();
        device.queue.submit([encoder.finish()]);
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}
normals();
