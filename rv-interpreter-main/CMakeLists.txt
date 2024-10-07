cmake_minimum_required(VERSION 3.14)
project(WasmInterpreter)

# Set the C++ standard
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Define the source file
set(SOURCE_FILE src/interpreter.cc)

# Set the output directory for the compiled WebAssembly to 'em_build'
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/em_build)

# Enable compile_commands.json generation
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Set compiler options for emcc
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O2 -s MODULARIZE=1 -s EXPORT_NAME=MyModule")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -s EXPORTED_FUNCTIONS=['_set_register','_prepare_code','_run_code','_free_code']")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -s EXTRA_EXPORTED_RUNTIME_METHODS=['FS','ccall','cwrap']")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -s FILESYSTEM=1 -s WASM_BIGINT=1")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -s INCOMING_MODULE_JS_API=print,printErr")

# Add the executable to generate the WebAssembly
add_executable(interpreter ${SOURCE_FILE})

# Set custom output for TypeScript definition file
add_custom_command(TARGET interpreter POST_BUILD
    COMMAND ${CMAKE_CXX_COMPILER} ${SOURCE_FILE} ${CMAKE_CXX_FLAGS} --emit-tsd ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/output.d.ts
    COMMENT "Generating WebAssembly with TypeScript definitions..."
)
