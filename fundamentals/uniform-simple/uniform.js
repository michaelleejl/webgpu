async function renderUniform() {
    let adapter = await navigator.gpu?.requestAdapter();
    let device = await adapter?.requestDevice();
    if (!device) {
        console.log("No GPU found");
    }
    let format = navigator.gpu?.getPreferredCanvasFormat();
    let canvas = document.querySelector('canvas');
    let context = canvas.getContext('webgpu');
    context.configure({ device, format });
    let module = device.createShaderModule({
        code: /*wgsl*/ `
            struct Custom {
                color: vec4f,
                scale: vec2f,
                offset: vec2f,
            };
            @group(0) @binding(0) var<uniform> custom: Custom;
            @vertex fn vs(
                @builtin(vertex_index) vertexIdx: u32
            ) -> @builtin(position) vec4f{
                let positions = array(
                    vec2f( 0.0,  0.5),
                    vec2f(-0.5, -0.5),
                    vec2f( 0.5, -0.5),
                );
                return vec4f(positions[vertexIdx] * custom.scale + custom.offset, 0.0, 1.0);
            };
            @fragment fn fs() -> @location(0) vec4f {
                return custom.color;
            };
        `
    });
    let pipeline = device.createRenderPipeline({
        vertex: {
            module
        },
        layout: "auto",
        fragment: {
            module,
            targets: [{ format }]
        }
    });
    let uniformBuffer = device.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const uniformValues = new Float32Array(8);
    const kColor = 0;
    const kScale = 4;
    const kOffset = 6;
    uniformValues.set([0, 1, 0, 1], kColor);
    uniformValues.set([-0.5, -0.25], kOffset);
    let group = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
    });
    function render() {
        let encoder = device.createCommandEncoder();
        const aspect = canvas.width / canvas.height;
        uniformValues.set([0.5 / aspect, 0.5], kScale);
        device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
        let pass = encoder.beginRenderPass({
            colorAttachments: [{
                    view: context.getCurrentTexture().createView(),
                    clearValue: [1, 1, 1, 1],
                    loadOp: 'clear',
                    storeOp: 'store'
                }]
        });
        pass.setBindGroup(0, group);
        pass.setPipeline(pipeline);
        pass.draw(3);
        pass.end();
        device.queue.submit([encoder.finish()]);
    }
    render();
}
renderUniform();
