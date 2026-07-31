const fs = require("fs").promises;
const path = require("path");
const Paths = require("../config/Paths");

class JsonRepository {

    static writeQueue = Promise.resolve();

    constructor(fileName) {

        this.filePath = path.join(

            Paths.data,

            fileName

        );

    }


    async readFile() {

        const content =
            await fs.readFile(
                this.filePath,
                "utf8"
            );

        return JSON.parse(content);

    }

    async writeFile(data) {

        JsonRepository.writeQueue =
            JsonRepository.writeQueue.then(async () => {

                await fs.writeFile(

                    this.filePath,

                    JSON.stringify(
                        data,
                        null,
                        4
                    )

                );

            });

        return JsonRepository.writeQueue;

    }

    async findAll() {

        return await this.readFile();

    }

    async findById(id) {

        const data = await this.readFile();

        console.log("========== JsonRepository ==========");
        console.log("ID recibido:", id);
        console.log("Primer registro:", data[0]);
        console.log("IDs disponibles:", data.map(x => x.id));

        const result = data.find(x => x.id === id);

        console.log("Resultado:", result);

        return result;
    }

    async create(entity) {

        const data =
            await this.readFile();

        data.push(entity);

        await this.writeFile(data);

        return entity;

    }

    async update(id, entity) {

        const data =
            await this.readFile();

        const index =
            data.findIndex(
                x => x.id === id
            );

        if (index < 0)
            return null;

        data[index] = entity;

        await this.writeFile(data);

        return entity;

    }

    async delete(id) {

        const data =
            await this.readFile();

        const filtered =
            data.filter(
                x => x.id !== id
            );

        await this.writeFile(filtered);

        return true;

    }

}
module.exports = JsonRepository;