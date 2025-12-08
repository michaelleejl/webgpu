async function render() {
    let adapter = await navigator.gpu?.requestAdapter();
    let device = await adapter?.requestDevice();
    if (!device) {
        console.log("No GPU found");
        return;
    }
    const canvas = document.querySelector('canvas');
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu?.getPreferredCanvasFormat();
    context.configure({ device, format });
    let module = device.createShaderModule({
        code: /*wgsl*/ `
            struct VertexShaderOutput {
                @builtin(position) positionData: vec4f,
            };
            @vertex fn vs(
                @builtin(vertex_index) vertexIdx: u32
            ) -> VertexShaderOutput {
                let position = array(
                    vec2f( 0.0,  0.5),
                    vec2f(-0.5, -0.5),
                    vec2f( 0.5, -0.5)
                );
                var output: VertexShaderOutput;
                output.positionData = vec4f(position[vertexIdx], 0.0, 1.0);
                return output;
            };
            @fragment fn fs(input: VertexShaderOutput) -> @location(0) vec4f {
                let red = vec4f(1, 0, 0, 1);
                let cyan = vec4f(0, 1, 1, 1);
                let grid = vec2u(input.positionData.xy) / 4 ;
                let checker = ((grid.x + grid.y) % 2) == 0;
                return select(cyan, red, checker);
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
    let encoder = device.createCommandEncoder();
    let pass = encoder.beginRenderPass({
        colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: [1, 1, 1, 1],
                loadOp: 'clear',
                storeOp: 'store'
            }]
    });
    pass.setPipeline(pipeline);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);
}
render();
