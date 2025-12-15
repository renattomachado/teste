import React, { Component } from "react";
import { Link } from "react-router-dom";
import Paper from "@material-ui/core/Paper";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";

import "../styles/string-art.css";

class StringArt extends Component {
  constructor(props) {
    super(props);
    this.state = {
      imageSrc: null,
      processedReady: false,
      brightness: 20,
      contrast: 20,
      threshold: 80,
      nailCount: 80,
      iterations: 220,
      lineThickness: 1.2,
      frameShape: "circle",
      diameter: 480,
      width: 520,
      height: 520,
      vectorPath: [],
      nails: [],
      loading: false
    };
    this.sourceCanvasRef = React.createRef();
    this.processedCanvasRef = React.createRef();
  }

  handleImageUpload = event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      this.setState(
        {
          imageSrc: e.target.result,
          processedReady: false,
          vectorPath: [],
          nails: []
        },
        () => this.processImage()
      );
    };
    reader.readAsDataURL(file);
  };

  setNumericState = field => event => {
    const value = Number(event.target.value);
    if (Number.isNaN(value)) return;
    this.setState({ [field]: value }, () => {
      if (this.state.processedReady) this.processImage();
    });
  };

  setFrameShape = event => {
    const shape = event.target.value;
    this.setState({ frameShape: shape }, () => {
      if (this.state.processedReady) this.processImage();
    });
  };

  processImage = () => {
    if (!this.state.imageSrc) return;
    this.setState({ loading: true }, () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 640;
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const sourceCanvas = this.sourceCanvasRef.current;
        const processedCanvas = this.processedCanvasRef.current;
        sourceCanvas.width = width;
        sourceCanvas.height = height;
        processedCanvas.width = width;
        processedCanvas.height = height;

        const sourceCtx = sourceCanvas.getContext("2d");
        sourceCtx.drawImage(img, 0, 0, width, height);
        const imageData = sourceCtx.getImageData(0, 0, width, height);
        const grayData = this.toGrayscale(imageData);
        const enhancedData = this.applyBrightnessContrast(
          grayData,
          this.state.brightness,
          this.state.contrast
        );
        const edges = this.detectEdges(enhancedData, width, height);
        const nails = this.buildNails(width, height);
        const vectorPath = this.buildStringPath(edges, width, height, nails);
        this.drawResult(enhancedData, edges, width, height, nails, vectorPath);
        this.setState({ processedReady: true, vectorPath, nails, loading: false });
      };
      img.src = this.state.imageSrc;
    });
  };

  toGrayscale = imageData => {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
    return imageData;
  };

  applyBrightnessContrast = (imageData, brightness, contrast) => {
    const data = imageData.data;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    for (let i = 0; i < data.length; i += 4) {
      let val = factor * (data[i] - 128) + 128 + brightness;
      val = Math.max(0, Math.min(255, val));
      data[i] = data[i + 1] = data[i + 2] = val;
    }
    return imageData;
  };

  detectEdges = (imageData, width, height) => {
    const sobelX = [
      -1, 0, 1,
      -2, 0, 2,
      -1, 0, 1
    ];
    const sobelY = [
      -1, -2, -1,
       0,  0,  0,
       1,  2,  1
    ];

    const input = imageData.data;
    const output = new Uint8ClampedArray(input.length);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let pixelX = 0;
        let pixelY = 0;
        let idx = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pos = ((y + ky) * width + (x + kx)) * 4;
            pixelX += input[pos] * sobelX[idx];
            pixelY += input[pos] * sobelY[idx];
            idx++;
          }
        }

        const magnitude = Math.sqrt(pixelX * pixelX + pixelY * pixelY);
        const outPos = (y * width + x) * 4;
        const value = magnitude > this.state.threshold ? 255 : 0;
        output[outPos] = output[outPos + 1] = output[outPos + 2] = value;
        output[outPos + 3] = 255;
      }
    }

    return new ImageData(output, width, height);
  };

  buildNails = (width, height) => {
    const { frameShape, nailCount, diameter } = this.state;
    const nails = [];

    if (frameShape === "circle") {
      const size = Math.min(width, height, diameter);
      const radius = size / 2 - 6;
      const cx = width / 2;
      const cy = height / 2;
      for (let i = 0; i < nailCount; i++) {
        const angle = (2 * Math.PI * i) / nailCount;
        nails.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
      }
      return nails;
    }

    const isSquare = frameShape === "square";
    const side = Math.min(width, height, this.state.width, this.state.height);
    const w = isSquare ? side : Math.min(width, this.state.width);
    const h = isSquare ? side : Math.min(height, this.state.height);
    const offsetX = (width - w) / 2;
    const offsetY = (height - h) / 2;
    const perimeter = 2 * (w + h);
    const step = perimeter / nailCount;
    let distance = 0;

    for (let i = 0; i < nailCount; i++) {
      const d = distance % perimeter;
      if (d <= w) {
        nails.push({ x: offsetX + d, y: offsetY });
      } else if (d <= w + h) {
        nails.push({ x: offsetX + w, y: offsetY + d - w });
      } else if (d <= 2 * w + h) {
        nails.push({ x: offsetX + (2 * w + h - d), y: offsetY + h });
      } else {
        nails.push({ x: offsetX, y: offsetY + (perimeter - d) });
      }
      distance += step;
    }
    return nails;
  };

  sampleLineDarkness = (edges, width, x0, y0, x1, y1) => {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let samples = 0;
    let score = 0;

    let x = Math.round(x0);
    let y = Math.round(y0);
    while (true) {
      const idx = (y * width + x) * 4;
      score += 255 - edges.data[idx];
      samples++;
      if (x === Math.round(x1) && y === Math.round(y1)) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
    return score / Math.max(samples, 1);
  };

  buildStringPath = (edges, width, height, nails) => {
    const { iterations } = this.state;
    if (!nails.length) return [];
    const path = [];
    let current = 0;

    for (let i = 0; i < iterations; i++) {
      let bestScore = -Infinity;
      let bestIndex = null;
      for (let n = 0; n < nails.length; n++) {
        if (n === current) continue;
        const score = this.sampleLineDarkness(
          edges,
          width,
          nails[current].x,
          nails[current].y,
          nails[n].x,
          nails[n].y
        );
        if (score > bestScore) {
          bestScore = score;
          bestIndex = n;
        }
      }
      if (bestIndex === null) break;
      path.push({ from: current, to: bestIndex });
      current = bestIndex;
    }
    return path;
  };

  drawResult = (enhancedData, edges, width, height, nails, vectorPath) => {
    const canvas = this.processedCanvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.putImageData(enhancedData, 0, 0);

    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.putImageData(edges, 0, 0);
    ctx.restore();

    ctx.strokeStyle = "#111";
    ctx.lineWidth = this.state.lineThickness;
    ctx.lineCap = "round";

    vectorPath.forEach(segment => {
      const start = nails[segment.from];
      const end = nails[segment.to];
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    });

    ctx.fillStyle = "#00796b";
    nails.forEach(nail => {
      ctx.beginPath();
      ctx.arc(nail.x, nail.y, 2.5, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  renderVectorPath = () => {
    const { vectorPath, nails } = this.state;
    if (!vectorPath.length) return <Typography variant="body2">Carregue uma imagem para gerar o vetor.</Typography>;
    return (
      <div className="vector-panel">
        <Typography variant="subtitle1">Sequência de linhas (from ➜ to)</Typography>
        <div className="vector-list">
          {vectorPath.slice(0, 200).map((segment, index) => (
            <div key={index} className="vector-item">
              {index + 1}. {segment.from} ➜ {segment.to} ({Math.round(nails[segment.from].x)}, {Math.round(nails[segment.from].y)}) → ({Math.round(nails[segment.to].x)}, {Math.round(nails[segment.to].y)})
            </div>
          ))}
          {vectorPath.length > 200 && (
            <Typography variant="caption">...{vectorPath.length - 200} linhas adicionais não exibidas</Typography>
          )}
        </div>
      </div>
    );
  };

  render() {
    const { frameShape, brightness, contrast, threshold, nailCount, iterations, lineThickness, diameter, width, height, loading } = this.state;
    return (
      <div className="string-art-page">
        <div className="page-header">
          <Typography variant="h4" component="h1">StringArt Studio</Typography>
          <Typography variant="subtitle1">
            PoC para transformar imagens em vetor de linhas seguindo moldura e pregos configuráveis.
          </Typography>
          <Typography variant="body2" className="breadcrumb">
            <Link to="/home">Voltar para home</Link>
          </Typography>
        </div>

        <Paper className="panel">
          <Typography variant="h6">1. Escolha a imagem de referência</Typography>
          <input type="file" accept="image/*" onChange={this.handleImageUpload} />
        </Paper>

        <Paper className="panel">
          <Typography variant="h6">2. Ajustes de contraste e realce</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Brilho"
                type="number"
                value={brightness}
                onChange={this.setNumericState("brightness")}
                helperText="Realce sem perder nitidez"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Contraste"
                type="number"
                value={contrast}
                onChange={this.setNumericState("contrast")}
                helperText="Ajuste de contraste para clarear bordas"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Sensibilidade de borda"
                type="number"
                value={threshold}
                onChange={this.setNumericState("threshold")}
                helperText="Limiar para o filtro Sobel"
              />
            </Grid>
          </Grid>
        </Paper>

        <Paper className="panel">
          <Typography variant="h6">3. Moldura e pregos</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                select
                label="Formato"
                fullWidth
                value={frameShape}
                onChange={this.setFrameShape}
              >
                <MenuItem value="circle">Circular</MenuItem>
                <MenuItem value="square">Quadrado</MenuItem>
                <MenuItem value="rectangle">Retângulo</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label={frameShape === "circle" ? "Diâmetro" : "Largura"}
                type="number"
                value={frameShape === "circle" ? diameter : width}
                onChange={this.setNumericState(frameShape === "circle" ? "diameter" : "width")}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label={frameShape === "circle" ? "Diâmetro" : "Altura"}
                type="number"
                value={frameShape === "circle" ? diameter : height}
                onChange={this.setNumericState(frameShape === "circle" ? "diameter" : "height")}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Qtd. de pregos"
                type="number"
                value={nailCount}
                onChange={this.setNumericState("nailCount")}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Qtd. de iterações"
                type="number"
                value={iterations}
                onChange={this.setNumericState("iterations")}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Espessura do fio"
                type="number"
                value={lineThickness}
                onChange={this.setNumericState("lineThickness")}
              />
            </Grid>
          </Grid>
          <Divider className="divider" />
          <Button variant="contained" color="primary" onClick={this.processImage} disabled={!this.state.imageSrc || loading}>
            {loading ? "Processando..." : "Gerar StringArt"}
          </Button>
        </Paper>

        <Paper className="panel">
          <Typography variant="h6">4. Visualização</Typography>
          <Grid container spacing={16}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1">Pré-processamento</Typography>
              <canvas ref={this.sourceCanvasRef} className="canvas" />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1">StringArt (vetor)</Typography>
              <canvas ref={this.processedCanvasRef} className="canvas" />
            </Grid>
          </Grid>
        </Paper>

        <Paper className="panel">
          <Typography variant="h6">5. Vetor de linhas</Typography>
          {this.renderVectorPath()}
        </Paper>
      </div>
    );
  }
}

export default StringArt;
