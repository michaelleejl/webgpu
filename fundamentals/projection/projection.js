async function projection() {
    let adapter = await navigator.gpu?.requestAdapter();
    let device = await adapter.requestDevice();
    if (!device) {
        console.log("No suitable GPU found");
    }
    let format = navigator.gpu.getPreferredCanvasFormat();
    let canvas = document.querySelector('canvas');
    let context = canvas.getContext('webgpu');
    context.configure({
        device, format
    });
    let module = device.createShaderModule({
        code: /*wgsl*/ `
            struct VertexInput{
                @location(0) position: vec3f,
                @location(1) color: vec4f,
            }

            struct VertexOutput{
                @builtin(position) position: vec4f,
                @location(0) color: vec4f
            }

            @group(0) @binding(0) var<uniform> time: f32;

            @vertex fn vs_main(in: VertexInput) -> VertexOutput {

                let c = cos(time);
                let s = sin(time);

                let cf = cos(-3.0 * 3.14 / 4.0);
                let sf = sin(-3.0 * 3.14 / 4.0);

                let S = transpose(mat4x4f(
                    0.3, 0.0, 0.0, 0.0,
                    0.0, 0.3, 0.0, 0.0,
                    0.0, 0.0, 0.3, 0.0,
                    0.0, 0.0, 0.0, 1.0
                ));

                let Ts = transpose(mat4x4f(
                    1.0, 0.0, 0.0, 0.4,
                    0.0, 1.0, 0.0, 0.0,
                    0.0, 0.0, 1.0, 0.0,
                    0.0, 0.0, 0.0, 1.0
                ));

                let R1 = transpose(mat4x4f(
                    c  ,  -s, 0.0, 0.0,
                    s  ,   c, 0.0, 0.0,
                    0.0, 0.0, 1.0, 0.0,
                    0.0, 0.0, 0.0, 1.0
                ));

                let R2 = transpose(mat4x4f(
                    1.0, 0.0, 0.0, 0.0,
                    0.0,  cf, -sf, 0.0,
                    0.0,  sf,  cf, 0.0,
                    0.0, 0.0, 0.0, 1.0
                ));

                let T = R2 * R1 * Ts * S;

                let focalLength = 2.0;
                let focalPoint = vec3f(0.0, 0.0, -5.0);
                var pos = (T * vec4f(in.position, 2.0)).xyz - focalPoint;

                let near = 0.1;
                let far = 10.0;
                let scale = 1.0;
                let P = transpose(mat4x4f(
                    focalLength, 0.0, 0.0, 0.0,
                    0.0, focalLength*2.0, 0.0, 0.0,
                    0.0, 0.0, far/((far - near)), -(far*near)/((far - near)),
                    0.0, 0.0, 1.0, 0.0
                ));

                // I want: between 0 and 1
                // AFTER dividing by z (where z is a variable!!)

                var out: VertexOutput;
                out.position = P * vec4f(pos, 1.0);
                out.color    = in.color;
                return out;
            }

            @fragment fn fs_main(in: VertexOutput) -> @location(0) vec4f {
                return in.color;
            }
        `
    });
    let vertices = [
        [-0.5, -0.5, -0.3],
        [0.5, -0.5, -0.3],
        [0.5, 0.5, -0.3],
        [-0.5, 0.5, -0.3],
        [0.0, 0.0, 0.5],
    ];
    let colors = [
        [0, 0, 80, 255],
        [0, 0, 80, 255],
        [0, 0, 80, 255],
        [0, 0, 80, 255],
        [0, 0, 255, 255],
    ];
    let vertexData = new Float32Array(5 * 4);
    let colorData = new Uint8Array(vertexData.buffer);
    for (let i = 0; i < vertices.length; i++) {
        vertexData.set(vertices[i], i * 4);
        colorData.set(colors[i], 4 * (3 + (4 * i)));
    }
    let vertexAndColorBuffer = device.createBuffer({
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    let indexData = new Uint32Array([
        0, 1, 2, 0, 2, 3, 0, 4, 1, 1, 4, 2, 2, 4, 3, 3, 4, 0
    ]);
    let indexBuffer = device.createBuffer({
        size: indexData.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    let shaderTexture = device.createTexture({
        size: [canvas.width, canvas.height, 1],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    let pipeline = device.createRenderPipeline({
        vertex: {
            module,
            buffers: [{
                    arrayStride: 16,
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x3' },
                        { shaderLocation: 1, offset: 12, format: 'unorm8x4' },
                    ]
                }
            ]
        },
        fragment: {
            module,
            targets: [{ format }]
        },
        depthStencil: {
            format: 'depth24plus',
            stencilReadMask: 0,
            stencilWriteMask: 0,
            depthCompare: 'less',
            depthWriteEnabled: true
        },
        layout: "auto"
    });
    let timeBuffer = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    let bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{
                binding: 0,
                resource: timeBuffer
            }]
    });
    device.queue.writeBuffer(vertexAndColorBuffer, 0, vertexData, 0);
    device.queue.writeBuffer(indexBuffer, 0, indexData, 0);
    var angle = 0.0;
    function frame() {
        let encoder = device.createCommandEncoder();
        let timeData = new Float32Array([angle]);
        device.queue.writeBuffer(timeBuffer, 0, timeData, 0);
        let pass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: context.getCurrentTexture().createView(),
                    loadOp: 'clear',
                    storeOp: 'store',
                    clearValue: [1.0, 1.0, 1.0, 1.0]
                }
            ],
            depthStencilAttachment: {
                view: shaderTexture.createView(),
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
                depthClearValue: 1.0,
            }
        });
        pass.setBindGroup(0, bindGroup);
        pass.setVertexBuffer(0, vertexAndColorBuffer);
        pass.setIndexBuffer(indexBuffer, 'uint32');
        pass.setPipeline(pipeline);
        pass.drawIndexed(indexData.length);
        pass.end();
        device.queue.submit([encoder.finish()]);
        angle += 0.01;
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}
projection();
