import express from 'express';
import dotenv from 'dotenv';
import dbConnection from './db/dbConnection.js';
import multer from 'multer';
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import Post from './modules/post.js';


const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

dotenv.config();

const awsBucketName = process.env.AWS_BUCKET_NAME;
const awsRegion = process.env.AWS_REGION;
const accessKey = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!awsBucketName || !awsRegion || !accessKey || !secretAccessKey) {
    console.log('❌AWS credentials are not set');
    process.exit(1);
}


const s3 = new S3Client({
    credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretAccessKey
    },
    region: awsRegion
})

const app = express();
app.use(express.json());
dbConnection();


app.get("/", (req, res) => {
    res.json({ message: "you can test the api on /posts just to add a post method (title , content , image)" })
})
app.post("/posts", upload.single('image'), async (req, res) => {
    try {

        const { title, content } = req.body;
        const image = req.file


        const params = {
            Bucket: awsBucketName,
            Key: randomImageName() + "-" + req.file.originalname,
            Body: image.buffer,
            ContentType: req.file.mimetype
        };

        const aws_command = new PutObjectCommand(params);
        await s3.send(aws_command);

        const command = new GetObjectCommand(params);
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

        const post = await Post.create({
            title,
            content,
            image: url
        });

        res.status(200).json({ message: 'Post created successfully', post });
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: 'Internal server error' });
    }
})

const PORT = process.env.PORT;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


