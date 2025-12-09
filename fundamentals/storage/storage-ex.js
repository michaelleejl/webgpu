async function storage() {
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
        `
    });
    let pipeline = device.createRenderPipeline({
        vertex: { module },
        layout: "auto",
        fragment: { module, targets: [{ format }] }
    });
    let n = 100;
    let bufferSize = n * 4 * (2 + 2 + 4);
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
    var scales = [];
    var offsets = [];
    var colors = [];
    let sOffset = 0;
    let oOffset = 2 * n;
    let cOffset = (2 + 2) * n;
    for (let i = 0; i < n; i++) {
        let s = [rand(0.2, 0.5), rand(0.2, 0.5)];
        let o = [rand(-0.9, 0.9), rand(-0.9, 0.9)];
        let c = [rand(0, 1), rand(0, 1), rand(0, 1), 1];
        scales = scales.concat([s]);
        offsets = offsets.concat([o]);
        colors = colors.concat([c]);
    }
    values.set(scales, sOffset);
    values.set(offsets, oOffset);
    values.set(colors, cOffset);
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
    pass.draw(3 * n);
    pass.end();
    device.queue.submit([encoder.finish()]);
}
storage();
