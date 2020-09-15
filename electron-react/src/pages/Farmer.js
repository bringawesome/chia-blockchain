import React, { useEffect, useState, useCallback } from "react";
import Grid from "@material-ui/core/Grid";
import { makeStyles, withStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";
import { useSelector, useDispatch } from "react-redux";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import {
  Paper,
  TableRow,
  List,
  ListItem,
  ListItemText,
  Tooltip
} from "@material-ui/core";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import DeleteForeverIcon from "@material-ui/icons/DeleteForever";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import IconButton from "@material-ui/core/IconButton";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogContentText from "@material-ui/core/DialogContentText";
import DialogTitle from "@material-ui/core/DialogTitle";

import { closeConnection, openConnection } from "../modules/farmerMessages";
import {
  refreshPlots,
  deletePlot,
  getPlotDirectories
} from "../modules/harvesterMessages";

import TablePagination from "@material-ui/core/TablePagination";
import RefreshIcon from "@material-ui/icons/Refresh";
import Connections from "./Connections";

import { big_int_to_array, arr_to_hex, sha256 } from "../util/utils";
import { mojo_to_chia_string } from "../util/chia";
import HelpIcon from "@material-ui/icons/Help";
import { clearSend } from "../modules/message";
import AddPlotDialog from "./AddPlotDialog";

/* global BigInt */

const drawerWidth = 180;

const styles = theme => ({
  root: {
    display: "flex",
    paddingLeft: "0px"
  },
  tabs: {
    flexGrow: 1,
    marginTop: 40
  },
  clickable: {
    cursor: "pointer"
  },
  refreshButton: {
    marginLeft: "20px"
  },
  content: {
    height: "calc(100vh - 64px)",
    overflowX: "hidden",
    padding: "0px"
  },
  noPadding: {
    padding: "0px"
  },
  container: {
    paddingTop: theme.spacing(3),
    paddingRight: theme.spacing(6),
    paddingLeft: theme.spacing(6),
    paddingBottom: theme.spacing(3)
  },
  balancePaper: {
    padding: theme.spacing(2),
    marginTop: theme.spacing(2)
  },
  cardTitle: {
    paddingLeft: theme.spacing(1),
    paddingTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  cardSubSection: {
    paddingLeft: theme.spacing(3),
    paddingRight: theme.spacing(3),
    paddingTop: theme.spacing(1)
  },
  table: {
    minWidth: 650
  },
  drawerPaper: {
    position: "relative",
    whiteSpace: "nowrap",
    width: drawerWidth,
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen
    })
  },
  addPlotButton: {
    marginLeft: theme.spacing(2)
  }
});

const useStyles = makeStyles(styles);

const getStatusItems = (
  connected,
  farmerSpace,
  totalChia,
  biggestHeight,
  totalNetworkSpace
) => {
  var status_items = [];

  if (connected) {
    const item = {
      label: "Connection Status ",
      value: "Connected",
      colour: "green"
    };
    status_items.push(item);
  } else {
    const item = {
      label: "Connection Status ",
      value: "Not connected",
      colour: "red"
    };
    status_items.push(item);
  }
  const proportion = parseFloat(farmerSpace) / parseFloat(totalNetworkSpace);
  const totalHours = 5.0 / proportion / 60;

  status_items.push({
    label: "Total size of local plots",
    value: Math.floor(farmerSpace / Math.pow(1024, 3)).toString() + " GiB",
    tooltip:
      "You have " +
      (proportion * 100).toFixed(6) +
      "% of the space on the network, so farming a block will take " +
      totalHours.toFixed(3) +
      " hours in expectation"
  });

  status_items.push({
    label: "Total chia farmed",
    value: mojo_to_chia_string(totalChia)
  });
  if (biggestHeight === 0) {
    status_items.push({
      label: "Last height farmed",
      value: "No blocks farmed yet"
    });
  } else {
    status_items.push({
      label: "Last height farmed",
      value: biggestHeight
    });
  }

  return status_items;
};

const StatusCell = props => {
  const classes = useStyles();
  const item = props.item;
  const label = item.label;
  const value = item.value;
  const colour = item.colour;
  const tooltip = item.tooltip;
  return (
    <Grid item xs={6}>
      <div className={classes.cardSubSection}>
        <Box display="flex">
          <Box flexGrow={1}>
            <Typography variant="subtitle1">{label}</Typography>
          </Box>
          <Box display="flex">
            <Typography variant="subtitle1">
              <span style={colour ? { color: colour } : {}}>{value}</span>
            </Typography>
            {tooltip ? (
              <Tooltip title={tooltip}>
                <HelpIcon style={{ color: "#c8c8c8", fontSize: 12 }}></HelpIcon>
              </Tooltip>
            ) : (
              ""
            )}
          </Box>
        </Box>
      </div>
    </Grid>
  );
};

const FarmerStatus = props => {
  const plots = useSelector(state => state.farming_state.harvester.plots);
  const totalNetworkSpace = useSelector(
    state => state.full_node_state.blockchain_state.space
  );

  var farmerSpace = 0;
  if (plots !== undefined) {
    farmerSpace = plots.map(p => p.file_size).reduce((a, b) => a + b, 0);
  }

  const connected = useSelector(state => state.daemon_state.farmer_connected);
  const statusItems = getStatusItems(
    connected,
    farmerSpace,
    props.totalChiaFarmed,
    props.biggestHeight,
    totalNetworkSpace
  );

  const classes = useStyles();
  return (
    <Paper className={classes.balancePaper}>
      <Grid container spacing={0}>
        <Grid item xs={12}>
          <div className={classes.cardTitle}>
            <Typography component="h6" variant="h6">
              Farmer Status
            </Typography>
          </div>
        </Grid>
        {statusItems.map(item => (
          <StatusCell item={item} key={item.label}></StatusCell>
        ))}
      </Grid>
    </Paper>
  );
};

const Challenges = props => {
  const classes = useStyles();
  var latest_challenges = useSelector(
    state => state.farming_state.farmer.latest_challenges
  );

  if (!latest_challenges) {
    latest_challenges = [];
  }
  return (
    <Paper className={classes.balancePaper}>
      <Grid container spacing={0}>
        <Grid item xs={12}>
          <div className={classes.cardTitle}>
            <Typography component="h6" variant="h6">
              Challenges
            </Typography>
          </div>
          <TableContainer component={Paper}>
            <Table
              className={classes.table}
              size="small"
              aria-label="a dense table"
            >
              <TableHead>
                <TableRow>
                  <TableCell>Challenge hash</TableCell>
                  <TableCell align="right">Height</TableCell>
                  <TableCell align="right">Number of proofs</TableCell>
                  <TableCell align="right">Best estimate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {latest_challenges.map(item => (
                  <TableRow key={item.challenge}>
                    <TableCell component="th" scope="row">
                      {item.challenge.substring(0, 10)}...
                    </TableCell>
                    <TableCell align="right">{item.height}</TableCell>
                    <TableCell align="right">{item.estimates.length}</TableCell>
                    <TableCell align="right">
                      {item.estimates.length > 0
                        ? Math.floor(
                            Math.min.apply(Math, item.estimates) / 60
                          ).toString() + " minutes"
                        : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>
    </Paper>
  );
};

const Plots = props => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const plots = useSelector(state => state.farming_state.harvester.plots);
  const not_found_filenames = useSelector(
    state => state.farming_state.harvester.not_found_filenames
  );
  const failed_to_open_filenames = useSelector(
    state => state.farming_state.harvester.failed_to_open_filenames
  );
  plots.sort((a, b) => b.size - a.size);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [addDirectoryOpen, addDirectorySetOpen] = React.useState(false);
  const [deletePlotName, deletePlotSetName] = React.useState("");
  const [deletePlotOpen, deletePlotSetOpen] = React.useState(false);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = event => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const refreshPlotsClick = () => {
    dispatch(refreshPlots());
  };
  const addDirectoryHandleClose = () => {
    addDirectorySetOpen(false);
  };

  const handleCloseDeletePlot = () => {
    deletePlotSetOpen(false);
  };

  const handleCloseDeletePlotYes = () => {
    handleCloseDeletePlot();
    dispatch(deletePlot(deletePlotName));
  };

  return (
    <Paper className={classes.balancePaper}>
      <Grid container spacing={0}>
        <Grid item xs={12}>
          <div className={classes.cardTitle}>
            <Typography component="h6" variant="h6">
              Plots
              <Button
                variant="contained"
                color="primary"
                onClick={refreshPlotsClick}
                className={classes.refreshButton}
                startIcon={<RefreshIcon />}
              >
                Refresh plots
              </Button>
              <Button
                variant="contained"
                color="primary"
                className={classes.addPlotButton}
                onClick={() => {
                  dispatch(getPlotDirectories());
                  addDirectorySetOpen(true);
                }}
              >
                Manage plot directories
              </Button>
              <AddPlotDialog
                classes={{
                  paper: classes.paper
                }}
                id="ringtone-menu"
                keepMounted
                open={addDirectoryOpen}
                onClose={addDirectoryHandleClose}
              />
            </Typography>
          </div>

          <TableContainer component={Paper}>
            <Table
              className={classes.table}
              size="small"
              aria-label="a dense table"
            >
              <TableHead>
                <TableRow>
                  <TableCell>Filename</TableCell>
                  <TableCell align="right">Size</TableCell>
                  <TableCell align="right">Plot id</TableCell>
                  <TableCell align="right">Plot pk</TableCell>
                  <TableCell align="right">Pool pk</TableCell>
                  <TableCell align="right">Delete</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {plots
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map(item => (
                    <TableRow key={item.filename}>
                      <TableCell component="th" scope="row">
                        <Tooltip title={item.filename} interactive>
                          <span>{item.filename.substring(0, 40)}...</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        {item.size} (
                        {Math.round(
                          (item.file_size * 1000) / (1024 * 1024 * 1024)
                        ) / 1000}
                        GiB)
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title={item["plot-seed"]} interactive>
                          <span>{item["plot-seed"].substring(0, 10)}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title={item.plot_public_key} interactive>
                          <span>
                            {item.plot_public_key.substring(0, 10)}...
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title={item.pool_public_key} interactive>
                          <span>
                            {item.pool_public_key.substring(0, 10)}...
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell
                        className={classes.clickable}
                        onClick={() => {
                          deletePlotSetName(item.filename);
                          deletePlotSetOpen(true);
                        }}
                        align="right"
                      >
                        <DeleteForeverIcon fontSize="small"></DeleteForeverIcon>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[10, 25, 100]}
            component="div"
            count={plots.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onChangePage={handleChangePage}
            onChangeRowsPerPage={handleChangeRowsPerPage}
          />

          {not_found_filenames.length > 0 ? (
            <span>
              <div className={classes.cardTitle}>
                <Typography component="h6" variant="h6">
                  Not found plots
                </Typography>
              </div>
              <p>
                Caution, deleting these plots will delete them forever. Check
                that the storage devices are properly connected.
              </p>
              <List dense={classes.dense}>
                {not_found_filenames.map(filename => (
                  <ListItem key={filename}>
                    <ListItemText primary={filename} />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={() => {
                          deletePlotSetName(filename);
                          deletePlotSetOpen(true);
                        }}
                      >
                        <DeleteForeverIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>{" "}
            </span>
          ) : (
            ""
          )}
          {failed_to_open_filenames.length > 0 ? (
            <span>
              <div className={classes.cardTitle}>
                <Typography component="h6" variant="h6">
                  Failed to open (invalid plots)
                </Typography>
              </div>
              <p>
                These plots are invalid, you might want to delete them forever.
              </p>
              <List dense={classes.dense}>
                {failed_to_open_filenames.map(filename => (
                  <ListItem key={filename}>
                    <ListItemText primary={filename} />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={() => {
                          deletePlotSetName(filename);
                          deletePlotSetOpen(true);
                        }}
                      >
                        <DeleteForeverIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </span>
          ) : (
            ""
          )}
        </Grid>
      </Grid>
      <Dialog
        open={deletePlotOpen}
        onClose={handleCloseDeletePlot}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{"Delete all keys"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to delete the plot? The plot cannot be
            recovered.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeletePlot} color="secondary">
            Back
          </Button>
          <Button
            onClick={handleCloseDeletePlotYes}
            color="secondary"
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

const FarmerContent = props => {
  const classes = useStyles();
  const dispatch = useDispatch();

  const connections = useSelector(
    state => state.farming_state.farmer.connections
  );

  const connectionError = useSelector(
    state => state.farming_state.farmer.open_connection_error
  );

  const openConnectionCallback = (host, port) => {
    dispatch(openConnection(host, port));
  };
  const closeConnectionCallback = node_id => {
    dispatch(closeConnection(node_id));
  };
  return (
    <Container maxWidth="lg" className={classes.container}>
      <Grid container spacing={3}>
        {/* Chart */}
        <Grid item xs={12}>
          <FarmerStatus
            totalChiaFarmed={props.totalChiaFarmed}
            biggestHeight={props.biggestHeight}
          ></FarmerStatus>
        </Grid>
        <Grid item xs={12}>
          <Challenges></Challenges>
        </Grid>
        <Grid item xs={12}>
          <Plots></Plots>
        </Grid>
        <Grid item xs={12}>
          <Connections
            connections={connections}
            connectionError={connectionError}
            openConnection={openConnectionCallback}
            closeConnection={closeConnectionCallback}
          ></Connections>
        </Grid>
      </Grid>
    </Container>
  );
};

const Farmer = props => {
  const dispatch = useDispatch();

  const [totalChiaFarmed, setTotalChiaFarmed] = useState(BigInt(0));
  const [biggestHeight, setBiggestHeight] = useState(0);
  const [didMount, setDidMount] = useState(false);

  const wallets = useSelector(state => state.wallet_state.wallets);

  const classes = props.classes;

  const checkRewards = useCallback(async () => {
    let totalChia = BigInt(0);
    let biggestHeight = 0;
    for (let wallet of wallets) {
      if (!wallet) {
        continue;
      }
      for (let tx of wallet.transactions) {
        if (!didMount) return;
        if (tx.additions.length < 1) {
          continue;
        }
        console.log("Checking tx", tx);
        // Height here is filled into the whole 256 bits (32 bytes) of the parent
        let hexHeight = arr_to_hex(
          big_int_to_array(BigInt(tx.confirmed_at_index), 32)
        );
        // Height is a 32 bit int so hashing it requires serializing it to 4 bytes
        let hexHeightHashBytes = await sha256(
          big_int_to_array(BigInt(tx.confirmed_at_index), 4)
        );
        let hexHeightDoubleHashBytes = await sha256(hexHeightHashBytes);
        let hexHeightDoubleHash = arr_to_hex(hexHeightDoubleHashBytes);

        if (
          hexHeight === tx.additions[0].parent_coin_info ||
          hexHeight === tx.additions[0].parent_coin_info.slice(2) ||
          hexHeightDoubleHash === tx.additions[0].parent_coin_info ||
          hexHeightDoubleHash === tx.additions[0].parent_coin_info.slice(2)
        ) {
          totalChia += BigInt(tx.amount);
          if (tx.confirmed_at_index > biggestHeight) {
            biggestHeight = tx.confirmed_at_index;
          }
          continue;
        }
      }
    }
    if (totalChia !== totalChiaFarmed) {
      setTotalChiaFarmed(totalChia);
      setBiggestHeight(biggestHeight);
    }
  }, [totalChiaFarmed, didMount, wallets]);

  useEffect(() => {
    (async () => {
      await checkRewards();
      if (!didMount) {
        setDidMount(true);
        dispatch(clearSend);
      }
    })();
  }, [checkRewards, dispatch, props, didMount, setDidMount]);

  return (
    <div className={classes.root}>
      <main className={classes.content}>
        <Container maxWidth="lg" className={classes.noPadding}>
          <FarmerContent
            totalChiaFarmed={totalChiaFarmed}
            biggestHeight={biggestHeight}
          ></FarmerContent>
        </Container>
      </main>
    </div>
  );
};

export default withStyles(styles)(Farmer);
