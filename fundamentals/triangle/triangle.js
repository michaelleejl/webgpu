async function main() {

    // Requests a GPU
    const adapter = await navigator.gpu?.requestAdapter();
    // Creates a logical device associated with that adapter.
    // The device is what you use to create buffers, shaders, pipelines,
    // and submit command buffers to be executed on the GPU.
    const device = await adapter?.requestDevice();
    if (!device) {
        console.log("GPU not found")
        return;
    }

    // Get the canvas that will display the rendered output
    const canvas = document.querySelector('canvas');
    // Get the interface for displaying visuals on the canvas
    // You give it a texture (output of GPU), and it will manage the
    // displaying of the pixture on the canvas.
    // e.g., to avoid flickering / tearing, it'll use double buffering
    // but you can just call functions
    const context = canvas.getContext('webgpu');
    // Get the GPU's preferred pixel format for the textures (layout of buffers in a double buffering system)
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat()

    // Configure the canvas context so it knows:
    //   - which device will provide the rendered textures
    //   - what texture format those textures will be in
    // After this, each frame you call getCurrentTexture()
    // to get a texture you can render into.
    context.configure({
        device,
        format: presentationFormat,
    });

    // Creates a shader module with a name, a vertex shader, and a fragment shader.
    // The vertex shader looks up a vertexIndex (u32) in the vertex_index position
    // This is a special built in position that tells the vertex shader which
    // vertex it is currently processing.
    // It outputs a vector of 4 floats. It is called 3 times, each representing
    // a point on the triangle.
    // The fragment shader doesn't receive any inputs: it is a constant function
    // that outputs a vector of 4 floats, representing blue.
    const module = device.createShaderModule({
        label: "triangle shader",
        code: /* wsgl */ `
            @vertex fn vs(
                @builtin(vertex_index) vertexIndex: u32
            ) -> @builtin(position) vec4f {
                let pos = array(
                    vec2f( 0.0 ,  0.5),
                    vec2f(-0.5 , -0.5),
                    vec2f( 0.5 , -0.5)
                );
                return vec4f(pos[vertexIndex], 0, 1);
            }

            @fragment fn fs() -> @location(0) vec4f {
                return vec4f(0, 0, 1, 1);
            }
        `
    })

    // Creates a render pipeline which links the vertex shader and the fragment shader
    // layout: auto means WebGPU picks the bindgroup layout
    // For the fragment shader, also indicate the format of the texture output
    const pipeline = device.createRenderPipeline({
        label: "triangle renderer pipeline",
        layout: "auto",
        vertex : {
            module
        },
        fragment: {
            module,
            targets: [{ format: presentationFormat }],
        }
    })

    // Confguration for the render pass, including a name, and a color
    // attachment. The color attachment describes, for each
    // texture created by the pipeline,
    // what the pixel color should be if nothing is displayed,
    // what to do before rendering the image
    // what to do after rendering the image
    const renderPassDescriptor = {
        label: "triangle render pass",
        colorAttachments: [
            {
                clearValue: [1, 1, 1, 1],
                loadOp: 'clear',
                storeOp: 'store',
            }
        ]
    }

    // The rendering function
    function render() {

        // canvas provides a new GPU texture each frame: this gets it.
        renderPassDescriptor.colorAttachments[0].view =
            context.getCurrentTexture().createView();

        // create command encoder
        const encoder = device.createCommandEncoder({ label: 'triangle encoder' })
        // set up the rendering pass
        const pass = encoder.beginRenderPass(renderPassDescriptor)
        // set up the pipeline
        pass.setPipeline(pipeline)
        // invokes the vertex shader 3 times
        pass.draw(3)
        // end the pass, perform cleanup
        pass.end()
        // finish the commands
        const commandBuffer = encoder.finish()
        // submit them to the GPU
        device.queue.submit([commandBuffer])
    }
    render()

}

main();
